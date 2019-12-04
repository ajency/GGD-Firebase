import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as express from 'express';
import * as cors from 'cors';
import * as bodyParser from 'body-parser';
import * as nodemailer from 'nodemailer';
import * as smtpTransport from 'nodemailer-smtp-transport';
import { routesConfig } from './routes-config';

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

// export const api = functions.https.onRequest(app);

exports.dataBaseTriggers = functions.region('asia-east2').firestore.document("payments/{paymentId}").onUpdate(async (snap, context) => {
	try {

		let payment_data = snap.after.data()
		let firestore = admin.firestore();
		let pay_details = JSON.parse(payment_data.other_details)
		let sms_msg ='';
		let email_subject ='';
		let email_to = '';
		let email_html = '';
		let logo = "https://greengrainbowl.com/wp-content/themes/ajency-portfolio/images/logo_new.png";
		let bottom_img ="https://greengrainbowl.com/wp-content/themes/ajency-portfolio/images/Leaf_with_seperator@2x.png"
		
		let order_ref = await firestore.collection("user-details").doc(payment_data.user_id).collection('orders').doc(payment_data.order_id).get()
		if(!order_ref.exists) {
			return null
		}

		let order_data = order_ref.data()
		let items = ''		
		order_data.items.forEach((item) => {
			items=items+`<tr><td>${item.name}</td> <td>${item.quantity}</td> <td>${item.sale_price}</td></tr>`
		});
		if(payment_data.status == 'captured') {
			sms_msg = `Your GGB order no. ${payment_data.pg_order_id} for Rs. ${(pay_details.amount/100)} is successfuly placed`
			email_subject = `Order Placed  Sucessfully order id: ${payment_data.pg_order_id}`
			email_html =`
					<h1>Order placed sucessfuly</h1>
					<p>Order id: ${payment_data.pg_order_id}</p> 
					<p> Amount: Rs. ${(pay_details.amount/100)} </p> `
		} else if(payment_data.status == 'failed'                                                             ) {
			sms_msg = `Your GGB order no. ${payment_data.pg_order_id} for Rs. ${(pay_details.amount/100)} is failed please try again`
			email_subject = `Payment Failed : ${payment_data.pg_order_id}`
			email_html =`
					<h1>Order was not placed</h1>
					<p>Order id: ${payment_data.pg_order_id}</p> 
					<p> Amount: Rs. ${(pay_details.amount/100)} </p>
					<div>
						<table>
						<tr>
							<th>item</th>
							<th>quantity</th>
							<th>amount</th>
						</tr>
						${items}
						</table>
					</div>
			`
		} else {
			return null
		}
		console.log(sms_msg)
		console.log("sending mail started")

		if(order_data.shipping_address.email !='') {
			const transporter = nodemailer.createTransport(smtpTransport({
				service: 'gmail',
				auth: {
					user: 'ggb.aj.test@gmail.com',
					pass: 'idingqurvsvotbyi'
				}
			}));
			
			const mailOptions = {
				from: 'no-reply@ajency.com', // Something like: Jane Doe <janedoe@gmail.com>
				to: order_data.shipping_address.email,
				subject: email_subject, // email subject
				html: email_html
			};
			console.log("Email option",mailOptions)
	
			// returning result
		  transporter.sendMail(mailOptions).then((info) => {
			console.log("mail sent to ",order_data.shipping_address.email)
		  }).catch((e) => {
			console.log("mail sent to ",order_data.shipping_address.email)
		  })
		}
	
	}catch(e) {
		console.log(e)
		
	}
	return null 

})

