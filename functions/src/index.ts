import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as express from 'express';
import * as cors from 'cors';
import * as bodyParser from 'body-parser';
import * as nodemailer from 'nodemailer';
import { routesConfig } from './routes-config';
import axios from 'axios';
import Utils from './controllers/utils';
let config = require('../credentials.json')
let serviceAccount = require('../serviceAccount.json');

if (process.env.X_GOOGLE_FUNCTION_IDENTITY) {
	admin.initializeApp(functions.config().firebase);
}
else {
	admin.initializeApp({
		credential: admin.credential.cert(serviceAccount),
		databaseURL: "https://project-ggb-dev.firebaseio.com"
	});
}

const app = express();
app.use(bodyParser.json());
app.use(cors({ origin: true }));

routesConfig(app)
export const api = functions.region('asia-east2').https.onRequest(app);

exports.dataBaseTriggers = functions.region('asia-east2').firestore.document("payments/{paymentId}").onUpdate(async (snap, context) => {
	try {

		let payment_data = snap.after.data()
		let firestore = admin.firestore();
		let pay_details = JSON.parse(payment_data.other_details)
		let sms_msg ='', email_subject ='', email_html = '';
		let email_content= {
			name:'',
			order_nos:'',
			msg:'',
			date:'',
			items:'',
			customer_name:'',
			address:'',
			summary:''
		};	
		let order_ref = await firestore.collection("user-details").doc(payment_data.user_id).collection('orders').doc(payment_data.order_id).get()
		if(!order_ref.exists) {
			return null
		}
		let order_data = order_ref.data()
		if(payment_data.status == 'captured') {
			sms_msg = `Your order no. ${payment_data.order_id} for Rs. ${(pay_details.amount/100)} has been received and the meal is being prepared. You will be notified once the order is ready`
			email_subject = `Order Placed  Sucessfully order id: ${payment_data.pg_order_id}`
			email_content.msg = ` <p>Hi <strong>${order_data.shipping_address.name},</strong></p>
			<p>Thanks for placing an order with us.</p>
			<p>We are on it. We'll notify you when your bowl(s) is ready for pick-up.</p>`
			email_content.order_nos = payment_data.order_id;
			var dateTemp = payment_data.timestamp.toDate()
			let date = new Date(dateTemp)
			email_content.date = date.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year: 'numeric' });
			for(let item of  order_data.items) {
				let prod_img ='http://greengrainbowl.com/wp-content/themes/ajency-portfolio/images/products/cracked-wheat-n-chickpea-bowl-chicken.jpg'
				if(item.product_id !='') {
					let prod_ref = await firestore.collection('products').doc(item.product_id).get()	
					prod_img =  prod_ref.data().image_urls[0]
					email_content.items=email_content.items+`
					<div class="item-container flex-column">
					<div class="d-flex mb-4">
					<div class="product-cartimage d-inline-block">
						<img class="" alt="" title="" height="50" width="50" src="${prod_img}">
					</div>
					<div class="product-details d-inline-block">
						<div class="product-title-c font-weight-light">
							${item.product_name}
						</div>
						<div class="">
							<div class="product-size-c text-capitalize">
							${item.size}
							</div>
							<div class="product-size-c">
							Qty: ${item.quantity}
							</div>                      
						</div>            
					</div>
					<div class="d-flex align-items-center">                            
						<div class="product-price font-weight-light text-right pl-3">
							₹${item.sale_price}
						</div>
					</div>
					</div>
				</div>		
				`
				}
			}
			email_content.address =`${order_data.shipping_address.address}, ${order_data.shipping_address.landmark}, ${order_data.shipping_address.formatted_address}`
			email_content.summary = `
				<div class="summary-item pt-0">
					<div class="w-50">
						<label class="font-weight-light">Total Item Price</label>
					</div>
				<div class="font-weight-light w-50 text-right">₹${order_data.summary.sale_price_total} </div>
				</div>
				<div class="summary-item">
					<div class="w-50">
						<label class="font-weight-light">Delivery fee</label>
					</div>
					<div class="font-weight-light w-50 text-right">₹${order_data.summary.shipping_fee}</div>
				</div>
				<div class="summary-item border-grey-y mt-8">
					<div class="w-50">
						<label class="font-weight-medium mb-0"><strong>Total</strong></label>
					</div>
					<div class="font-weight-bold w-50 text-right"><strong>₹${order_data.summary.you_pay}</strong></div>
				</div>
			`
			email_html =  Utils.getEmailMarkup(email_content)
			if(order_data.shipping_address.email !='') {
		
				var transporter = nodemailer.createTransport({
					port: 587,
					host: 'email-smtp.us-east-1.amazonaws.com',
					secure: false,
					auth: {
					user:config.aws_user ,
					pass: config.aws_pass
					},
					debug: true
				});
				const mailOptions = {
					from: 'Greengrainbowl.com<no-reply@greengrainbowl.com>', // Something like: Jane Doe <janedoe@gmail.com>
					to: order_data.shipping_address.email,
					subject: email_subject, // email subject
					html: email_html
				};
				console.log("Email option",mailOptions)
				await transporter.sendMail(mailOptions).then((info) => {
					console.log("mail sent to ",order_data.shipping_address.email)
				}).catch((e) => {
					console.log("mail sent failed to ",e)
				})
		
			}
		} else if(payment_data.status == 'failed') {
			return null
		} else {
			return null
		}
		console.log(sms_msg)

	
		if(order_data.shipping_address.phone != '') {
			let msgUrlParams = {
				params: {
					method:"SendMessage",
					send_to: order_data.shipping_address.phone,
					msg: sms_msg,
					msg_type:"TEXT",
					userid:"2000189884",
					auth_scheme: "plain",
					password:"UlpEzUe5L",
					v:'1.1',
					format:"text"
				}
			}	
			axios.get('http://enterprise.smsgupshup.com/GatewayAPI/rest', msgUrlParams).then(ress => {
				console.log(ress)
			})
			.catch(err => {
				console.log(err)
			})
		}
	
	}catch(e) {
		console.log(e)
		
	}
	return null 

})