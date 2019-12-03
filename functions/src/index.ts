import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as express from 'express';
import * as cors from 'cors';
import * as bodyParser from 'body-parser';
// import * as nodemailer from 'nodemailer';
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

let sendSms = function() {
console.log("tsss")
};
exports.dataBaseTriggers = functions.region('asia-east2').firestore.document("payments/{paymentId}").onUpdate(async (snap, context) => {
	try {

		sendSms()
		let payment_data = snap.after.data()
		let firestore = admin.firestore();

		let pay_details = JSON.parse(payment_data.other_details)
		let sms_msg ='';
		// let order_ref = await firestore.collection("user-details").doc(payment_data.user_id).collection('orders').doc(payment_data.order_id).get()
		if(payment_data.status == 'caputed') {
			sms_msg = `Your GGB order no. ${payment_data.pg_order_id} for Rs. ${(pay_details.amount/100)} is successfuly placed`
		} else {
			sms_msg = `Your GGB order no. ${payment_data.pg_order_id} for Rs. ${(pay_details.amount/100)} is failed please try again`
		}
		console.log(sms_msg)
		// console.log("sending mail started")
		// 	let transporter = nodemailer.createTransport({
		// 		host: 'debugmail.io',
		// 		port: 25,
		// 		secure:false,
		// 		auth: {
		// 			user: 'latesh@ajency.in',
		// 			pass: '4e7d0490-15a3-11ea-93a3-89ecb888fae5'
		// 		}
		// 	})

		
		// const mailOptions = {
		// 	from: 'latesh@ajency.in', // Something like: Jane Doe <janedoe@gmail.com>
		// 	to: "viraj@ajency.in",
		// 	subject: 'Got ur order', // email subject
		// 	html: `<p style="font-size: 16px;">Pickle Riiiiiiiiiiiiiiiick!!</p>
		// 		<br />
		// 		<img src="https://images.prod.meredith.com/product/fc8754735c8a9b4aebb786278e7265a5/1538025388228/l/rick-and-morty-pickle-rick-sticker" />
		// 	` // email content in HTML
		// };
		// console.log("Email option",mailOptions)

		// // returning result
		//  await transporter.sendMail(mailOptions);
	}catch(e) {
		console.log(e)
		
	}
	return null 

})

