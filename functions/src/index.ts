import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as express from 'express';
import * as cors from 'cors';
import * as bodyParser from 'body-parser';
import * as nodemailer from 'nodemailer';
import * as smtpTransport from 'nodemailer-smtp-transport';
import { routesConfig } from './routes-config';
import Utils from './controllers/utils';
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
// let getEmailMarkup = (email_content) => {
// return	`		
// 				<html>
// 					<head>
// 					<link href="https://fonts.googleapis.com/css?family=Work+Sans:300,400,600,700&display=swap" rel="stylesheet">
// 					<style>
// 					  .email-container{
// 						  width: 550px;
// 						  margin: 0 auto;
// 						  font-family: 'Work Sans', sans-serif;
// 						  padding: 15px;
// 						  border: 1px solid #000;
// 					  }
// 					  .email-header{
// 						text-align: center;
// 						border-bottom: 1px solid #000;
// 						padding: 15px;
// 						padding-top: 0;
// 					  }
// 					  .email-header img{
// 						width: 150px;
// 					  }
// 					  .email-content{
// 						padding: 15px;
// 						padding-top: 30px;
// 					  }
// 					  .email-footer{
// 						padding: 15px;
// 					  }
// 					  .email-footer img{
// 						width: 95px;
// 						height: auto;
// 					  }
// 					  .bold{
// 						font-weight: 700;
// 					  }
// 					  .row{
// 						clear: both;
// 						overflow: hidden;
// 						padding: 15px 5px;
// 					  }
// 					  .w-50{
// 						width: 50%;
// 						float: left;
// 					  }
// 					  .w-50{
// 						width: 50%;
// 					  }
// 					  .w-30{
// 						width: 30%;
// 					  }
// 					  .w-20{
// 						width: 20%;
// 					  }
// 					  .text-left{
// 						text-align: left;
// 					  }
// 					  .text-right{
// 						text-align: right;
// 					  }
// 					  .text-center{
// 						text-align: center;
// 					  }
// 					  .text-green{
// 						color: #48A748;
// 					  }
// 					  p{
// 						margin: 0;
// 						margin-bottom: 25px;
// 					  }
// 					  .border-grey{
// 						border: 1px solid #c4c8c4;
// 					  } 
// 					  th, td{
// 						padding: 5px;
// 					  } 
// 					  .mb-25{
// 						margin-bottom: 25px;
// 					  }
// 					  .mb-05{
// 						margin-bottom: 10px;
// 					  }
// 					  table{
// 						padding-top: 15px;
// 						padding-bottom: 15px;
// 					  }
// 					  .email-footer{
// 						position: relative;
// 					  }
// 					  .email-footer .line{
// 						position: absolute;
// 						top: 50%;
// 						left: 0;
// 						width: 100%;
// 						transform: translateY(-50%);
// 						margin: 0;
// 						height: 0.5px;
// 						background: #000;
// 					  }
// 					  .email-footer img{
// 						position: relative;
// 						z-index: 1;
// 						background: #fff;
// 						padding: 0 10px;
// 					  }
// 					  .d-block{
// 						display: block;
// 					  }
// 					</style>
// 					</head>
// 					<body>
// 					<div class="email-container">
// 					<div class="email-header">
// 					  <img src="https://greengrainbowl.com/wp-content/themes/ajency-portfolio/images/logo_new.png">
// 					</div>
// 					<div class="email-content">
// 					  	${email_content.msg}
// 						<p class="bold">Order details</p>
// 						<div class="mb-25">
// 						  <div class="row border-grey">
// 							<div class="w-50">
// 							  <div class="mb-05">Order No: <span class="bold">${email_content.order_nos}</span></div>
// 							  <div class="">Date: <span class="bold">${email_content.date}</span></div>
// 							</div>
// 							<div class="w-50">
// 							  <div class="mb-05">Customer Name:</div>
// 							  <div class="bold">${email_content.customer_name}</div>
// 							</div>
// 						  </div>
// 						</div>
// 						<table width="100%" class="border-grey">
// 						  <tr>
// 							  <th class="text-left w-50">Item Name</th>
// 							  <th class="text-left w-30 text-center">Qty</th>
// 							  <th class="text-right w-20">Price</th>
// 						  </tr>
// 						  ${email_content.items}
// 						</table>
// 					</div>   
// 					<div class="email-footer text-center">
// 						<img src="https://greengrainbowl.com/wp-content/themes/ajency-portfolio/images/Leaf_with_seperator@2x.png" />
// 						<div class="line"></div>
// 					</div>
// 				  </div>
// 					</body>

// 				</html>
// 			`
// }

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
			customer_name:''
		};	
		let order_ref = await firestore.collection("user-details").doc(payment_data.user_id).collection('orders').doc(payment_data.order_id).get()
		if(!order_ref.exists) {
			return null
		}
		let order_data = order_ref.data()
		let items = ''		
		
		if(payment_data.status == 'captured') {
			sms_msg = `Your order no. ${payment_data.pg_order_id} for Rs. ${(pay_details.amount/100)} has been received and the meal is being prepared. You ill be notified once the order is ready`
			email_subject = `Order Placed  Sucessfully order id: ${payment_data.pg_order_id}`
			email_content.msg = `<p>Hi,</p>
			<p>Thanks for placing an order with us.</p>
			<p>We are on it. We'll notify you when your bowl(s) is ready for pick-up.</p>`
			email_content.order_nos = payment_data.pg_order_id;
			email_content.customer_name = order_data.shipping_address.name
			var dateTemp = payment_data.timestamp.toDate()
			let date = new Date(dateTemp)
			email_content.date = date.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year: 'numeric' });
			order_data.items.forEach((item) => {
				email_content.items=email_content.items+`
					<tr>
					<td>${item.product_name}<span class="d-block">(${item.size})</span></td>
					<td class="text-center">${item.quantity} x ${item.sale_price}</td>
					<td class="text-right">${(item.quantity * item.sale_price)}</td>
					</tr>
				`
			});

			email_content.items = email_content.items+ `
				<tr>
				<td></td>
				<td class="text-green bold text-right">Grand Total</td>
				<td class="text-green bold text-right">${ pay_details.amount/100}</td>
       			 </tr>`
			email_html = Utils.getEmailMarkup(email_content)
		} else if(payment_data.status == 'failed') {
			// sms_msg = `Your order no. ${payment_data.pg_order_id} for Rs. ${(pay_details.amount/100)} is failed please try again`
			// email_subject = `Payment Failed : ${payment_data.pg_order_id}`
			// email_html = ''
			return null
		} else {
			return null
		}
		console.log(sms_msg)
		console.log("sending mail started")

		if(order_data.shipping_address.email !='') {
			const transporter = nodemailer.createTransport(smtpTransport({
				service: 'gmail',
				auth: {
					user:"ggb.aj.test@gmail.com",//config.email_username,
					pass: "idingqurvsvotbyi"//config.email_password
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
		  await transporter.sendMail(mailOptions).then((info) => {
			console.log("mail sent to ",order_data.shipping_address.email)
		  }).catch((e) => {
			console.log("mail sent failed to ",order_data.shipping_address.email)
		  })
		}
	
	}catch(e) {
		console.log(e)
		
	}
	return null 

})

