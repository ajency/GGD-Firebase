import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as express from 'express';
import * as cors from 'cors';
import * as bodyParser from 'body-parser';
import * as nodemailer from 'nodemailer';
import { routesConfig } from './routes-config';
import axios from 'axios';
import Utils from './controllers/utils';
import * as Airtable from 'airtable';
import PaymentGateway from './controllers/PaymentController';
const cred = require('../credentials.json');
Airtable.configure({
	endpointUrl: 'https://api.airtable.com',
	apiKey: cred.airtableApiKey
})
const base = Airtable.base(cred.airtableBase);
const DAYS = { "sunday": "Sunday", "monday": "Monday", "tuesday": "Tuesday", "wednesday": "Wednesday", "thursday": "Thursday", "friday": 'Friday', 'saturday': "Saturday" };
const SLOTS = { "lunch": "Lunch", "dinner": "Dinner" };

const generalConfig = require('../config.json');
let config = require('../credentials.json')
let serviceAccount = require('../serviceAccount.json');
if (process.env.X_GOOGLE_FUNCTION_IDENTITY) {
	admin.initializeApp(functions.config().firebase);
}
else {
	admin.initializeApp({
		credential: admin.credential.cert(serviceAccount),
		databaseURL: config.database_url
	});
}

const app = express();
app.use(bodyParser.json());
app.use(cors({ origin: true }));

routesConfig(app)
export const api = functions.region('asia-east2').https.onRequest(app);

exports.dataBaseTriggers = functions.region('asia-east2').firestore.document("user-details/{userDetailsId}/orders/{paymentId}").onUpdate(async (snap, context) => {
	try {
		let order_data = snap.after.data();
		let prev_order_data = snap.before.data();
		let firestore = admin.firestore();
		if (!order_data.userNotified) {

			let sms_msg = '', email_subject = '', email_html = '';
			let email_content = {
				name: '',
				order_nos: '',
				msg: '',
				date: '',
				items: '',
				address: '',
				summary: '',
				url: '',
				label: "Order placed"
			};
			let payment_ref = await firestore.collection('payments').where("order_id", "==", snap.after.id).get()
			let payment_data = payment_ref.docs[0].data()
			let pay_details = JSON.parse(payment_data.other_details)

			let cus_name = order_data.shipping_address.name.trim().split(" ")[0]
			cus_name = cus_name.charAt(0).toUpperCase() + cus_name.slice(1)
			let showItem, totalItem, secondItem
			if (order_data.items.length > 2) {
				let item_temp_arr = order_data.items.map((i) => {
					return i.quantity
				})
				let item_max = Math.max.apply(Math, item_temp_arr);
				showItem = order_data.items[item_temp_arr.indexOf(item_max)]
				totalItem = item_temp_arr.length - 2
				item_temp_arr.splice(item_temp_arr.indexOf(item_max))
				item_max = Math.max.apply(Math, item_temp_arr);
				secondItem = order_data.items[item_temp_arr.indexOf(item_max)]

			}
			email_content.url = `${generalConfig.frontendUrl}/#/order-details/${snap.after.id}`

			if (order_data.order_mode == "kiosk") {
				email_content.url = `https://greengrainbowl.com/oyo/#/order-details/${snap.after.id}`
				email_content.address = `<div class=""><strong>Pick up from: </strong> Cafeteria, 5th Floor, Oyo Office, Patto</div> `
			} else {
				let addressLabel = order_data.shipping_address.address ? `${order_data.shipping_address.address}, ` : ""
				email_content.address = `<div class=""><strong>Delivery Address: </strong></div>
					${addressLabel}${order_data.shipping_address.landmark}, ${order_data.shipping_address.formatted_address}`
			}

			if (order_data.status.toLowerCase() == 'placed' && order_data.order_mode == "online") {
				sms_msg = `We have received your GreenGrain Bowl order. We are on it. To check the order status visit ${email_content.url}`
				// sms_msg = `Thanks for your order (number ${snap.after.id} for Rs.${order_data.summary.you_pay}). We are on it. We'll notify you when your bowl(s) is ready for pick-up.`

				// if(order_data.items.length > 2) {
				// 	sms_msg = `Thank you for your order ${snap.after.id} of Rs. ${order_data.summary.you_pay} 
				// 		for ${showItem.product_name}  and ${secondItem.product_name} and ${totalItem} other bowl(s),
				// 		 We are on it. Check your order at <link>`
				// } else if(order_data.items.length == 2) {
				// 	sms_msg = `Thank you for your order ${snap.after.id} of Rs. ${order_data.summary.you_pay} 
				// 	for ${order_data.items[0].product_name} and ${order_data.items[1].product_name} bowl, We are on it. Check your order at <link>`

				// } else {
				// 	sms_msg = `Thank you for your order ${snap.after.id} of Rs. ${order_data.summary.you_pay} 
				// 	for ${order_data.items[0].product_name}  bowl, We are on it. Check your order at <link>`
				// }

				email_subject = `Thank you for your order at Green Grain Bowl`
				email_content.msg = ` <p style="margin: 0; margin-bottom: 25px;">Hi <strong>${cus_name},</strong></p>
				<p style="margin: 0; margin-bottom: 25px;">Thanks for placing an order with us. We are on it.</p>`


			} else if (order_data.status.toLowerCase() == 'placed' && order_data.order_mode == 'kiosk' && order_data.food_status == '' && order_data.delivery_status == '') {
				sms_msg = `We have received your GreenGrain Bowl order. We are on it. To check the order status visit ${email_content.url}`
				// sms_msg = `Thanks for your order (number ${snap.after.id} for Rs.${order_data.summary.you_pay}). We are on it. We'll notify you when your bowl(s) is ready for pick-up.`
				// if(order_data.items.length > 2) {
				// 	// sms_msg = `Thank you for your order ${snap.after.id} of Rs. ${order_data.summary.you_pay} for ${showItem.product_name}  and ${secondItem.product_name} and ${totalItem} other bowl(s), We are on it			`
				// } else if(order_data.items.length == 2) {
				// 	// sms_msg = `Thank you for your order ${snap.after.id} of Rs. ${order_data.summary.you_pay} for ${order_data.items[0].product_name} and ${order_data.items[1].product_name} bowl, We are on it.`

				// } else {
				// 	// sms_msg = `Thank you for your order ${snap.after.id} of Rs. ${order_data.summary.you_pay} for ${order_data.items[0].product_name}  bowl, We are on it.`
				// }
				email_subject = `Thank you for your order at Green Grain Bowl`
				email_content.msg = ` <p>Hi <strong>${cus_name},</strong></p>
				<p>A lot of time and effort has gone into creating each bowl.</p>
				<p>What’s great is that it’s a beautifully balanced meal, cooked from scratch, using fresh, seasonal produce.
				Happy to have you join our tribe that eats well, and feels great!</p>`

			} else if (order_data.status.toLowerCase() == 'failed') {
				return null
			} else if (prev_order_data.status.toLowerCase() == "placed" && order_data.status.toLowerCase() == 'accepted' && order_data.order_mode == 'online' && order_data.food_status == '' && order_data.delivery_status == '') {
				return null
			} else if (prev_order_data.status.toLowerCase() == "placed" && order_data.status.toLowerCase() == 'rejected') {
				return null
			} else if (prev_order_data.food_status == "" && order_data.food_status == "being_prepared") {
				return null
			} else if (prev_order_data.food_status == "being_prepared" && order_data.food_status == "food_is_ready" && order_data.order_mode == "online" && order_data.delivery_status == '') {
				return null
			} else if (order_data.food_status.toLowerCase() == "food_is_ready" && order_data.order_mode == "kiosk" && order_data.delivery_status == '') {
				email_content.label = "ready for pickup"
				sms_msg = `Your bowl(s) is ready to be picked up. The token number is ${order_data.token}. Please show this SMS at the pick-up counter`
				email_subject = `Your bowl(s) is ready to be picked up`
				email_content.msg = ` <p>Hi <strong>${cus_name},</strong></p>
				<p>We are about to change the way you have tasted, perceived and experienced salads before.
				All dressed up, ready to be picked up - a well balanced meal, salad style, that promises to put a smile on your face.
				</p>
				<p>The token number is ${order_data.token}. Please show this Email at the pick-up counter</p>
			`
			} else if (prev_order_data.delivery_status == '' && order_data.food_status == 'food_is_ready' && order_data.delivery_status == 'picked_up') {
				return null
			} else if (prev_order_data.delivery_status == 'picked_up' && order_data.delivery_status == 'delivered') {
				return null
			} else if (prev_order_data.delivery_status == 'picked_up' && order_data.delivery_status == 'failed') {
				return null
			}



			email_content.order_nos = order_data.order_no;
			var dateTemp = order_data.timestamp.toDate()
			let date = new Date(dateTemp)
			email_content.date = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
			for (let item of order_data.items) {
				let prod_img = ''
				if (item.product_id != '') {
					let prod_ref = await firestore.collection('products').doc(item.product_id).get()
					const extraContent = item.day ? ` | ${DAYS[item.day]} | ${SLOTS[item.slot]}` : ''
					prod_img = prod_ref.data().image_urls[0]
					email_content.items = email_content.items + `
					<div class="item-container flex-column">
						<div class="d-flex mb-4" style="margin-bottom: 1.5rem!important;display:flex;">
						<div class="product-cartimage d-inline-block" style="padding-right: 10px;width: 17%;display: inline-block!important;">
							<img class="" alt="" title="" height="50" width="50" src="${prod_img}" style="object-fit: cover;border-radius: 50%;">
						</div>
						<div class="product-details d-inline-block" style="width: 100%;display:inline-block!important;">
							<div class="product-title-c font-weight-light">
								${item.product_name}
							</div>
							<div class="">
								<div class="product-size-c text-capitalize" style="font-size: 14px; line-height: 14px; margin-top: 5px;text-transform;">
								Size: ${item.size} | Qty: ${item.quantity}${extraContent}
								</div>                     
							</div>            
						</div>
						<div class="d-flex align-items-center" style="display: flex;">                            
							<div class="product-price font-weight-light text-right pl-3" style="text-align: right;">
								₹${item.sale_price}
							</div>
						</div>
					</div>
				</div>		
				`
				}
			}
			let del_fee_block = ''
			let discount_block =''
			let coupon_code =''
			if (order_data.order_mode == "online") {
				if(order_data.summary.cart_discount) {
					const labelDiscount = order_data.applied_coupon.coupon_category_label || "Cart Discount"
					const code = order_data.applied_coupon.code;
					coupon_code = `<div class="summary-item" style="display: flex; justify-content: space-between; padding-top: 0; padding-bottom: 10px;">
							<div class="w-50" style="width: 50%;float:left;">
								<label class="font-weight-light"><b>Coupon Code</b></label>
							</div>
							<div class="font-weight-light w-50 text-right" style="width:50%;text-align:right;">${code}</div>
						</div>`
					discount_block = `<div class="summary-item" style="display: flex; justify-content: space-between; padding-top: 0; padding-bottom: 10px;">
							<div class="w-50" style="width: 50%;float:left;">
								<label class="font-weight-light">${labelDiscount}</label>
							</div>
							<div class="font-weight-light w-50 text-right" style="width:50%;float:left;text-align:right;">-₹${order_data.summary.cart_discount}</div>
						</div>`
				}
				del_fee_block = `<div class="summary-item" style="display: flex; justify-content: space-between; padding-top: 0; padding-bottom: 10px;">
							<div class="w-50" style="width: 50%;float:left;">
								<label class="font-weight-light">Delivery fee</label>
							</div>
							<div class="font-weight-light w-50 text-right" style="width:50%;float:left;text-align:right;">₹${order_data.summary.shipping_fee}</div>
						</div>`
			}

			email_content.summary = `
					${coupon_code}
					<div class="summary-item pt-0" style="display: flex; justify-content: space-between; padding-top: 10px; padding-bottom: 0;">

						<div class="w-50" style="width: 50%;float:left;">
							<label class="font-weight-light">Total Item Price</label>
						</div>
					<div class="font-weight-light w-50 text-right" style="width:50%;float:left;text-align:right;">₹${order_data.summary.sale_price_total} </div>
					</div>
					${discount_block}
					${del_fee_block}
					<div class="summary-item" style="display: flex; justify-content: space-between; padding-top: 10px; padding-bottom: 10px;">
						<div class="w-50" style="width: 50%;float:left;">
							<label class="font-weight-medium mb-0"><strong>Total</strong></label>
						</div>
						<div class="font-weight-bold w-50 text-right" style="width:50%;float:left;text-align:right;"><strong>₹${order_data.summary.you_pay}</strong></div>
					</div>
				`

			email_html = Utils.getEmailMarkup(email_content)
			let transporter = nodemailer.createTransport({
				port: 587,
				host: config.aws_smtp_server,
				secure: false,
				auth: {
					user: config.aws_user,
					pass: config.aws_pass
				},
				debug: true
			});
			if (order_data.shipping_address.email != '') {

				const mailOptions = {
					from: 'Staging-Green Grain Bowl<no-reply@greengrainbowl.com>', // Something like: Jane Doe <janedoe@gmail.com>
					to: order_data.shipping_address.email,
					subject: email_subject, // email subject
					html: email_html
				};
				if(config.mode == 'prod') {
					mailOptions["bcc"] = "ggb@ajency.in"
					mailOptions.from = "Green Grain Bowl<no-reply@greengrainbowl.com>"
				}
				console.log("Email option", mailOptions)
				await transporter.sendMail(mailOptions).then((info) => {
					console.log("mail sent to ", order_data.shipping_address.email)
				}).catch((e) => {
					console.log("mail sent failed to ", e)
				})

			}

			if (order_data.shipping_address.phone != '') {
				// let tempe = "viraj@ajency.in"
				// const mailOptions = {
				// 	from: 'Green Grain Bowl<no-reply@greengrainbowl.com>', // Something like: Jane Doe <janedoe@gmail.com>
				// 	to: tempe,
				// 	subject: `GGB SMS from ${config.mode}`, // email subject
				// 	html: `<div>${sms_msg}<div>`
				// };
				// console.log("Email option", mailOptions)
				// await transporter.sendMail(mailOptions).then((info) => {
				// 	console.log("mail sent to ", order_data.shipping_address.email)
				// }).catch((e) => {
				// 	console.log("mail sent failed to ", e)
				// })

				if (config.mode == 'prod') {

					let msgUrlParams = {
						params: {
							method: "SendMessage",
							send_to: order_data.shipping_address.phone,
							msg: sms_msg,
							msg_type: "TEXT",
							userid: "2000189884",
							auth_scheme: "plain",
							password: "UlpEzUe5L",
							v: '1.1',
							format: "text"
						}
					}
					axios.get('http://enterprise.smsgupshup.com/GatewayAPI/rest', msgUrlParams).then(ress => {
						console.log("sms sent",ress)
					})
						.catch(err => {
							console.log("sms not sent",err)
						})
				}

				const addressId = order_data.shipping_address.id
				firestore.collection('user-details').doc(payment_data.user_id).get().then((userref) => {
					const userData = userref.data()
					const payload = {
						default_address_id: addressId,
					}
					if (!userData.verified) {
						payload['imported'] = "false";
					}
					userref.ref.update(payload).then(() => console.log("updated userdetails with address dddd")).catch((error) => console.log(error));
				}).catch((err) => console.log(err))
			}
		
		}

		if (!order_data.airtableUpdated && order_data.status == "placed") {
			let address = ""
			let address_extra = ''
			let dayArray = []
			for (const key in DAYS) {
				dayArray.push(key)
			}
			
			if (order_data.shipping_address.hasOwnProperty('address')) {
				if(order_data.shipping_address.address)
					address_extra = order_data.shipping_address.address + ', '
			}
			if (order_data.shipping_address.hasOwnProperty('landmark')) {
				if(order_data.shipping_address.landmark)
					address_extra = address_extra + order_data.shipping_address.landmark + ', '
			}
			address = address_extra + order_data.shipping_address.formatted_address;
			let airtableArray = []
			let airtableRec = {
				name: order_data.shipping_address.name,
				contact_no: order_data.shipping_address.phone,
				address:address,
				email: order_data.shipping_address.email,
				order_id: snap.after.id,
				order_no: order_data.order_no,
				order_status: order_data.status,
				payment_id: order_data.payment_id,
				razor_payment_id: '',
				order_date: order_data.timestamp.toDate().toISOString(),
				product_id: '',
				variant_id: '',
				product_name: '',
				quantity:'',
				amount:0,
				delivery_slot: '',
				delivery_day: '',
				bowl_size: '',
				// coupon_code:'',
				// discount:0,
				order_delivery_date: order_data.timestamp.toDate().toDateString()
			}
			
			let paymentRef = await firestore.collection('payments').doc(order_data.payment_id).get()
			const paymentData = paymentRef.data()
			airtableRec.razor_payment_id = paymentData.pg_payment_id
			const weekDay = order_data.timestamp.toDate().getDay();
			const orderDate = order_data.timestamp.toDate().toISOString()
			order_data.items.map((item) => {
				const { product_id, product_name, slot, day, variant_id, size, quantity, sale_price } = item
				airtableRec = {
					...airtableRec,
					product_id,
					product_name,
					variant_id,
					quantity,
					delivery_day: day,
					delivery_slot: slot,
					bowl_size:size,
					amount: (quantity * sale_price),
					order_delivery_date: order_data.timestamp.toDate().toDateString()
				}
				const bowlDay = dayArray.indexOf(day)
				//0 1 2 3 4 5 
				if(bowlDay != weekDay) {
					let delivery_date = new Date(orderDate||new Date());
					delivery_date.setDate(delivery_date.getDate() + (bowlDay - 1 - delivery_date.getDay() + 7) % 7 + 1);
					airtableRec.order_delivery_date = delivery_date.toDateString()
				}
				// if(order_data.summary.cart_discount) {
				// 	airtableRec.discount = order_data.summary.cart_discount
				// 	airtableRec.coupon_code = order_data.applied_coupon.code
				// }
				
				airtableArray.push(	{
					"fields": airtableRec
				})
			})
			console.log(airtableArray, "hereeeeeeeeeeeeeeeeeeeee");
			
			
			base('orders_by_bowl').create(airtableArray).then((res) => {
				console.log("Made entry in airtable", res)
				
			}).catch((e) => {
				console.log("Airtable entry failed ==>", e);
				
			})
			if(order_data.summary.cart_discount) {
				const coupons_redeemed = {
					user_id:paymentData.user_id,
					user_phone:order_data.shipping_address.phone,
					coupon_id:order_data.applied_coupon.id,
					coupon_code:order_data.applied_coupon.code,
					order_id:snap.after.id,
					timestamp:order_data.timestamp
				}
				firestore.collection("coupons_redeemed").doc().set(coupons_redeemed).then(() => {
					console.log("made entry in coupons_redeemed");
				}).catch((e) => {
					console.log(e)
				})

				firestore.collection("coupon_rules_log").where("operation","==","validate_cart").where("user_id","==",paymentData.user_id ).orderBy('timestamp').get().then(res =>{
					if(!res.empty){
						res.docs[0].ref.update({order_id:snap.after.id}).then( result => {
							console.log("logged order id");
							
						}).catch((e) => {
							console.log("loggin error");
							
						})
					}
				}).catch(e => {
					console.log(e)
				})
			}
	
		
		}
		if(!order_data.airtableUpdated || !order_data.userNotified ){
			snap.after.ref.update({
				airtableUpdated:true,
				userNotified: true
			}).then((res) => {
				console.log("user notified");
			}).catch(e => {
				console.log(e)
			})
		}

	} catch (e) {
		console.log(e)

	} finally {
		console.log("here")
	}
	return null

})

exports.couponsTriggers = functions.region('asia-east2').firestore.document("coupons/{couponId}").onWrite(async (snap, context) => {
	console.log("-----------------------------------------------");
	
	const id = snap.after.id
	const couponData = snap.after.data()
	console.log(couponData,id);
	snap.after.ref.update({id: id}).then((res) => {
		console.log(res)
	}).catch(e => {
		console.log(e);
		
	})
	const airtableRecordId = couponData.airtable_id
	base('coupons').update([
		{
			"id": airtableRecordId,
			"fields": {
				"firebase_id": id
			}
		}
	]).then((res) => {
		console.log(res);
		
	}).catch((e) => {
		console.log(e);
		
	})
});
