import * as admin from 'firebase-admin';
import { Request, Response } from "express";
import Products from './ProductController';
import Locations from './LocationsController';
import { insidePolygon, headingDistanceTo } from 'geolocation-utils';
import PaymentGateway from '../controllers/PaymentController';
const config = require('../../config.json');
let Order = {

	addToCart : async (req: Request, res: Response) => {
		try {
				let { variant_id, quantity, lat_long, cart_id, formatted_address } = req.body;

				if (!variant_id || !quantity || (!(lat_long && formatted_address) && !cart_id) ) {
						return res.status(400).send({ message: 'Missing fields' })
				}

				let cart_data = null;
				if(cart_id){
					cart_data = await Order.getOrderByID(cart_id);
				}
				else{
					cart_data = Order.getNewCartData(lat_long, formatted_address);
				}
				if(!cart_data)
					return res.status(400).send({ success: false, message: 'cart not found'});

				lat_long = cart_data.lat_long;


				let variant = await Products.getVariantById(variant_id);
				if(!variant)
					 return res.status(200).send({ success: false, message: 'Variant Not found'});
			
				let product = await Products.getProductById(variant.product_id);
				if(!product || !product.active)
					return res.status(200).send({ success: false, message: 'Product is not available'});
				
				let delivery_id;
				if(!cart_id){
					let locations = await Locations.getLocationWithStock(variant_id, quantity);
					if(locations && !locations.length)
						return res.status(200).send({ success: false, message: 'Quantity not availble'});


					let deliverable_locations = Order.isDeliverable(locations, lat_long);
					if(deliverable_locations && !deliverable_locations.length)
						return res.status(200).send({ success: false, message: 'Not deliverable at your location'});

					console.log("check deliverable location : ", deliverable_locations[0]);
					delivery_id = deliverable_locations[0].id;
				}
				else{
					delivery_id = cart_data.delivery_id;
					let location = [];
					if(delivery_id)
						location = await Locations.getLocation(delivery_id);
					let deliverable_locations = Order.isDeliverable(location, lat_long);
					if(deliverable_locations && !deliverable_locations.length)
						return res.status(200).send({ success: false, message: 'Not deliverable at your location'});

					let firestore = admin.firestore();
					let items = await firestore.collection("order_line_items").where('order_id', "==", cart_id).where("variant_id", "==", variant_id).get();

					let new_quantity = quantity;
					if(!items.empty){
						let item_data = items.docs[0].data();
						new_quantity = Number(item_data.quantity) + quantity;
					}

					let stock = await Locations.getStock(cart_data.delivery_id, variant_id, new_quantity);
					console.log("checking stock at existing delivery location", stock);
					if(!stock.length)
					 	return res.status(200).send({ success: false, message: 'Quantity not availble'});
				}
				let item = {
					attributes : {
						title : product.title,
						images : product.image_url,
						size : variant.size,
						mrp : variant.mrp,
						sale_price : variant.sale_price,
						discount_per : 0,
						description : product.description,
						veg : product.veg
					},
					quantity : quantity,
					variant_id : variant_id,
					product_id : variant.product_id
				}

				let order_data = await Order.updateOrder(item, cart_id, cart_data, delivery_id);
				let response : any = {
					success: true, 
					message: 'Successfully added to cart',
					item : item,
					summary : order_data.summary,
					cart_count : order_data.cart_count,
					cart_id : order_data.id,
				}
				return res.status(200).send(response);
				

		} catch (err) {
				return Order.handleError(res, err)
		}
	},

	removeFromCart : async (req: Request, res: Response) => {
		try {
			let { cart_id, variant_id, quantity } = req.body;
			if (!variant_id || !quantity || !cart_id) {
				return res.status(400).send({ message: 'Missing fields' })
			}
			let cart_data = null;
			cart_data = await Order.getOrderByID(cart_id);

			if(!cart_data) {
				return res.status(400).send({ success: false, message: 'cart not found'});
			}
			
			let firestore = admin.firestore();
			let items = await firestore.collection("order_line_items").where('order_id', "==", cart_id).where("variant_id", "==", variant_id).get();

			if(items.empty){
				return res.status(200).send({ success: false, message: 'Variant not available in cart'});
			}
			
			let item_data = items.docs[0].data()
			let item_data_id = items.docs[0].id;
			if(item_data.quantity < quantity){
				return res.status(200).send({ success: false, message: 'Invalid quantity'});
			}

			let new_quantity = Number(item_data.quantity) - quantity;
			
			if(new_quantity<=0) {
				cart_data.summary.mrp_total -= item_data.mrp * item_data.quantity;
				cart_data.summary.sale_price_total -= item_data.sale_price * item_data.quantity;
				cart_data.cart_count -= item_data.quantity;
				if(cart_data.cart_count == 0){
					cart_data.shipping_fee = 0;
				}
				await firestore.collection("order_line_items").doc(item_data_id).delete();
			} else {
			
				cart_data.summary.mrp_total -= item_data.mrp * quantity;
				cart_data.summary.sale_price_total 	-= item_data.sale_price * quantity;
				cart_data.cart_count = Number(cart_data.cart_count)-quantity;
				item_data.quantity = new_quantity;
				await firestore.collection("order_line_items").doc(item_data_id).update({quantity: new_quantity});
			}
			cart_data.summary.you_pay = cart_data.summary.sale_price_total + cart_data.summary.shipping_fee;
			await firestore.collection("orders").doc(cart_id).set(cart_data);
			
			let response = {
			  "message": "Successfully updated the cart",
			  "cart_count": cart_data.cart_count,
			  "summary": cart_data.summary,
			  success : true
			}

			return res.status(200).send(response);

		} catch (err) {
			return Order.handleError(res, err);
		}
	},

	handleError : (res: Response, err: any) => {
		return res.status(500).send({ message: `${err.code} - ${err.message}` });
	},

	isDeliverable : (locations : Array<any>, lat_long : any) => {
		console.log("finding deliverableLocation");
		let deliverble : any = [] ;
		locations.forEach((loc)=>{
			let location_1 = {lat: loc.lat_long[0].lat, lon: loc.lat_long[0].long}
			let location_2 = {lat: lat_long[0], lon: lat_long[1]};
			let diff = headingDistanceTo(location_1, location_2);
			console.log("radius diff==>", diff);
			if(diff.distance < loc.radius){
				deliverble.push(loc);
				return;
			}
		})
		return deliverble;
	},

	findCloset : (locations : Array<any>, lat_long : any) => {
		let closest_index : number = 0, min_diff = 999999;
		locations.forEach((loc, index)=>{
			let location_1 = {lat: 51, lon: 4};
			let location_2 = {lat: 51, lon: 4};
			let diff = headingDistanceTo(location_1, location_2);
				if(diff.distance < min_diff){
					closest_index = index;
					min_diff = diff.distance;
				}
		})
		return locations[closest_index];
	},

	getOrderByID : async (id : string) => {
		let firestore = admin.firestore();
		let order = await firestore.collection('orders').doc(id).get();
		if(order.exists){
			return order.data();
		}
		return null;
	},

	updateOrder : async (item, cart_id, cart_data, delivery_id) => {
		let firestore = admin.firestore();
		let order_line_items = [];
		let cart_id_for_order_line = cart_id;
		if(cart_id){
			let order_lines = await firestore.collection('order_line_items')
					.where("order_id", "==", cart_id)
					.where("variant_id", "==", item.variant_id)
					.get();

			
			order_lines.forEach(doc => {
				let obj = doc.data();
				obj.id = doc.id;
				order_line_items.push(obj);
			})
		}

		cart_data.summary.mrp_total 		+= item.attributes.mrp * item.quantity;
		cart_data.summary.sale_price_total 	+= item.attributes.sale_price * item.quantity;
		cart_data.summary.you_pay 			= cart_data.summary.sale_price_total + cart_data.summary.shipping_fee;
		cart_data.cart_count 				+= item.quantity;
		cart_data.delivery_id 				=  delivery_id;

		if(cart_id)
			await firestore.collection('orders').doc(cart_id).set(cart_data);
		else{
			let cart_ref = firestore.collection('orders').doc();
			cart_data.created_at = admin.firestore.FieldValue.serverTimestamp()
			await cart_ref.set(cart_data);
			cart_data.id = cart_ref.id;
			cart_id_for_order_line = cart_ref.id
		}

		if(order_line_items.length){
			await firestore.collection('order_line_items').doc(order_line_items[0].id)
				.update(
					{
						quantity : order_line_items[0].quantity + item.quantity,
						timestamp : admin.firestore.FieldValue.serverTimestamp()
					})
		}
		else{
			let order_line_ref = firestore.collection('order_line_items').doc();
			let order_line_data = {
				order_id : cart_id_for_order_line,
				variant_id : item.variant_id,
				quantity : item.quantity,
				product_name : item.attributes.title,
				description : item.attributes.description,
				mrp : item.attributes.mrp,
				sale_price : item.attributes.sale_price,
				veg : item.attributes.veg,
				size : item.attributes.size,
				product_id : item.product_id,
				timestamp : admin.firestore.FieldValue.serverTimestamp()
			}
			let order_line_success = await order_line_ref.set(order_line_data);
		}
		return cart_data;
	},

	fetchCart : async (req: Request, res: Response) =>{
		let firestore = admin.firestore();

		let cart_id = req.query.cart_id, order_line_items = [], items = [];
		console.log("cart_id");
		let cart = await firestore.collection('orders').doc(cart_id).get();
		let order_lines = await firestore.collection('order_line_items')
					.where("order_id", "==", cart_id)
					.get();

		order_lines.forEach(doc => {
			let obj = doc.data();
			order_line_items.push(obj);
		})

		let location;
		if(cart.data().delivery_id)
			location = await firestore.collection('locations').doc(cart.data().delivery_id).get();
		let deliverable = false;
		if(location && location.exists && Order.isDeliverable([location.data()], cart.data().lat_long).length){
			deliverable = true;
		}

		console.log("deliverable ==>", deliverable);
		for (const order_line of order_line_items) {
			let product = await firestore.collection('products').doc(order_line.product_id).get();
			let stocks_ref = await firestore.collection('stocks')
				.where("loc_id", "==", cart.data().delivery_id)
				.where("variant_id", "==", order_line.variant_id)
				.where("quantity", ">=", order_line.quantity)
				.get();
			let stocks = stocks_ref.docs.map(doc => {
				return doc.data()
			})

			console.log("stocks ==>", stocks);

			let item = {
				variant_id : order_line.variant_id,
				attributes: {
			        title: order_line.product_name,
			        images: {
			          "1x": product.data().image_url['1x'],
			          "2x": product.data().image_url['2x'],
			          "3x": product.data().image_url['3x']
			        },
			        size : order_line.size,
			        price_mrp : order_line.mrp,
			        price_final : order_line.sale_price,
			        discount_per : 0
			    },
		      	availability : stocks.length ? true : false,
		      	quantity : order_line.quantity,
		      	timestamp : order_line.timestamp,
		      	deliverable : deliverable,
		      	product_id : product.id
			}
			items.push(item);
		}

		if(cart.exists){
			let response = {
				success: true, 
				cart : cart.data(),
				coupon_applied: null,
				coupons: [],
				approx_delivery_time : "40 mins"
			}
			response.cart.items = items;
			return res.status(200).send(response);
		}
		return res.status(400).send({ success: false, message: 'cart not found'});		
	},

	getNewCartData : (lat_long, formatted_address) => {
		let cart_data : any = {
			user_id : '',
			summary : {
				mrp_total : 0,
				sale_price_total : 0,
				cart_discount : 0,
				shipping_fee : config.shipping_fee,
				you_pay : 0 + config.shipping_fee,
			},
			order_type : 'cart',
			cart_count : 0,
			lat_long : lat_long,
			formatted_address : formatted_address,
			delivery_id : '',
			verified : false,
			business_id : config.business_id
		}
		return cart_data;
	},


	updateDeliveryLocation : async (req: Request, res: Response) => {
		let firestore = admin.firestore();
		let { lat_long, cart_id, formatted_address } = req.body;
		if (!lat_long || !cart_id || !formatted_address ) {
			return res.status(400).send({ message: 'Missing fields' })
		}

		let cart_data = await Order.getOrderByID(cart_id);
		if(!cart_data)
			return res.status(400).send({ success: false, message: 'cart not found'});

		let locationsRef = await firestore.collection('locations').get();
		let allLocations = 	locationsRef.docs.map(doc => {
  			let obj = doc.data();
  			obj.id = doc.id;
  			return obj;
		});
		console.log("update delivery address all locations", allLocations);
		let delivery_id = '';
		let deliverable_locations = Order.isDeliverable(allLocations, lat_long);
		console.log("update delivery address deliverable locations", deliverable_locations);
		if(deliverable_locations && deliverable_locations.length)
			delivery_id = deliverable_locations[0].id;

		console.log("update delivery address delivery id ==>", delivery_id);
		await firestore.collection('orders').doc(cart_id)
				.update(
					{
						formatted_address : formatted_address,
						lat_long : lat_long,
						delivery_id : delivery_id
					})
		return res.status(200).send({ success : true , message: 'Address updated successfully' });
	},

	createOrder: async (req: Request, res:Response) => {
		let firestore = admin.firestore();
		let  order_line_items = [], items = [];
		let cart_id = req.body.cart_id;
		let address_id = req.body.address_id;
		let fetchDraft = req.body.fetchDraft; 

		let cart = await firestore.collection('orders').doc(cart_id).get();
		if(cart.data().type == 'order') {
		res.status(200).send({success:false, code:"PAYMENT_DONE", message: "Payment already done"})
		}
		
		let location;
		let order_lines = await firestore.collection('order_line_items')
					.where("order_id", "==", cart_id)
					.get();

		order_lines.forEach(doc => {
			let obj = doc.data();                                                                                                                                                                                                                                                                   
			order_line_items.push(obj);
		})
		

		if(cart.data().delivery_id)
			location = await firestore.collection('locations').doc(cart.data().delivery_id).get();
		
		let deliverable = false;
		let lat_lng = [], shipping_address
		if(fetchDraft) {
			console.log("here")
			lat_lng = cart.data().shipping_address.lat_long
			shipping_address = cart.data().shipping_address.lat_long
			console.log('here')
		} else {
			let address = await firestore.collection('addresses').doc(address_id).get();
			lat_lng = address.data().address.lat_long
			shipping_address = address.data().address

		}
		if(location && location.exists && Order.isDeliverable([location.data()], lat_lng).length){
			deliverable = true;
		}

		if(!deliverable) {
			 res.status(200).send({success:false, message:'Address is not deliverable'})
		}
		let user_details = {}
		if(cart.data().user_id) {
			let user_details_ref = await firestore.collection("user-details").doc(cart.data().user_id).get();
			if(user_details_ref.exists) {
				user_details = {
					name:user_details_ref.data().name,
					email:user_details_ref.data().email,
					contact:user_details_ref.data().phone,
				}
			}		
		}
		if(!fetchDraft) {
			await firestore.collection('orders').doc(cart_id).update({
				shipping_address: shipping_address,
				type:"draft"
			})
		}
		console.log("deliverable ==>", deliverable);
		

		for (const order_line of order_line_items) {
			let product = await firestore.collection('products').doc(order_line.product_id).get();
			let stocks_ref = await firestore.collection('stocks')
				.where("loc_id", "==", cart.data().delivery_id)
				.where("variant_id", "==", order_line.variant_id)
				.where("quantity", ">=", order_line.quantity)
				.get();
			let stocks = stocks_ref.docs.map(doc => {
				return doc.data()
			})

			
			console.log("stocks ==>", stocks);

			let item = {
				variant_id : order_line.variant_id,
				attributes: {
			        title: order_line.product_name,
			        images: {
			          "1x": product.data().image_url['1x'],
			          "2x": product.data().image_url['2x'],
			          "3x": product.data().image_url['3x']
			        },
			        size : order_line.size,
			        price_mrp : order_line.mrp,
			        price_final : order_line.sale_price,
			        discount_per : 0
			    },
		      	availability : stocks.length ? true : false,
		      	quantity : order_line.quantity,
		      	timestamp : order_line.timestamp,
		      	deliverable : deliverable,
		      	product_id : product.id
			}
			items.push(item);
		}

		let response = {
			success: true, 
			cart : cart.data(),
			coupon_applied: null,
			coupons: [],
			approx_delivery_time : "40 mins"
		}
		response.cart.items = items;
		response.cart.order_id = cart_id;
		response.cart.address = shipping_address;
		response.cart.type = "draft";
		response.cart.user_details = user_details
		res.status(200).send(response);

	},

	confirmOrder: async (req:Request, res:Response) => {
        try {
            let {id, order_id, amount, status} = req.body.payload.payment.entity
            amount = amount /100;
            let firestore, data, payment_ref, payment_doc ; 
            let razorpay_order = await PaymentGateway.getRazorpayOrder(order_id)
            firestore = admin.firestore();
            if(status != "failed") {
                firestore.collection('orders').doc(razorpay_order.receipt).update({
                    type:"order"
                })
            }
            data = {
                order_id:razorpay_order.receipt,
                payment_gateway:'Razorpay',
                pg_payment_id:id,
                pg_order_id:order_id,
                other_details:JSON.stringify(req.body.payload.payment.entity),
                pg_status:status,
				status:status,
				timestamp : admin.firestore.FieldValue.serverTimestamp()
            }
            payment_ref = firestore.collection('payments').doc();
            payment_doc =await payment_ref.set(data);
            return res.sendStatus(200);
        } catch (error) {
            return res.sendStatus(500);
        }
       
       
	},
	
	orderSummary: async (req:Request, res:Response) => {
        try {
			let order
			let firestore = admin.firestore();
			let paymentDoc = await firestore.collection('payments').where("pg_order_id","==", req.body.transaction_id).get()
            if(paymentDoc.docs.length == 0) {
                return res.status(200).send({success:true, pending:1});
            }
			let data = paymentDoc.docs[0].data();
			if(data.other_details) {
				data.other_details = JSON.parse(data.other_details)
			}
            if(data.order_id) {
				let order_id = data.order_id, order_line_items = [], items = [];
				console.log("cart_id");
				order = await firestore.collection('orders').doc(order_id).get();
				let order_lines = await firestore.collection('order_line_items')
							.where("order_id", "==", order_id)
							.get();

				order_lines.forEach(doc => {
					let obj = doc.data();
					order_line_items.push(obj);
				})

				for (const order_line of order_line_items) {
					let product = await firestore.collection('products').doc(order_line.product_id).get();
					let stocks_ref = await firestore.collection('stocks')
						.where("loc_id", "==", order.data().delivery_id)
						.where("variant_id", "==", order_line.variant_id)
						.where("quantity", ">=", order_line.quantity)
						.get();
					let stocks = stocks_ref.docs.map(doc => {
						return doc.data()
					})

					console.log("stocks ==>", stocks);

					let item = {
						variant_id : order_line.variant_id,
						attributes: {
							title: order_line.product_name,
							images: {
							"1x": product.data().image_url['1x'],
							"2x": product.data().image_url['2x'],
							"3x": product.data().image_url['3x']
							},
							size : order_line.size,
							price_mrp : order_line.mrp,
							price_final : order_line.sale_price,
							discount_per : 0
						},
						availability : stocks.length ? true : false,
						quantity : order_line.quantity,
						timestamp : order_line.timestamp,
						product_id : product.id
					}
					items.push(item);
				}

				order = order.data()
				order.items = items;
			} else {
				return res.status(200).send({success:false,message:"Error order not found" , pending:1}); 
			}
			let details = {
				order_data:order,
				payment_summary:data
			}
            return res.status(200).send({success:true, pending:0, summary:details, approx_delivery_time : "30 mins"});
        } catch (error) {
            return res.status(500).send({success:false, error:error})
        }
    },
}

export default Order;