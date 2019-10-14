import * as admin from 'firebase-admin';
import { Request, Response } from "express";
import Products from './ProductController';
import Locations from './LocationsController';
import { insidePolygon, headingDistanceTo } from 'geolocation-utils';

let Order = {

	checkAvailability : async (req: Request, res: Response) => {
		try {
				let { variant_id, quantity, lat_long, cart_id } = req.body;

				if (!variant_id || !quantity || (!lat_long && !cart_id) ) {
						return res.status(400).send({ message: 'Missing fields' })
				}

				let cart_data = null;
				if(cart_id){
					console.log("inside if");
					cart_data = await Order.getOrderByID(cart_id);
				}
				else{
					console.log("inside else");
					cart_data = Order.getNewCartData(lat_long);
				}
				console.log("check cart_data =>", cart_data);
				if(!cart_data)
					return res.status(400).send({ success: false, message: 'cart not found'});

				lat_long = cart_data.lat_long;


				let variant = await Products.getVariantById(variant_id);
				if(!variant)
					 return res.status(200).send({ success: false, message: 'Variant Not found'});
			
				let product = await Products.getProductById(variant.product_id);
				if(!product || !product.active)
					return res.status(200).send({ success: false, message: 'Product is not available'});
					
				let locations = await Locations.getLocations(variant_id, quantity);
				if(locations && !locations.length)
					return res.status(200).send({ success: false, message: 'Quantity not availble'});


				let deliverable_locations = Order.isDeliverable(locations, lat_long);
				if(deliverable_locations && !deliverable_locations.length)
					return res.status(200).send({ success: false, message: 'Not deliverable at your location'});

				console.log("check deliverable location : ", deliverable_locations[0]);
				let delivery_id = deliverable_locations[0].id;
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

	handleError : (res: Response, err: any) => {
		return res.status(500).send({ message: `${err.code} - ${err.message}` });
	},

	isDeliverable : (locations : Array<any>, lat_long : any) => {
		console.log("finding deliverableLocation");
		let deliverble : any = [] ;
		locations.forEach((loc)=>{
			if(loc.type === 'mobile'){
				let polygon = loc.lat_long.map(Object.values)
				if(insidePolygon(lat_long, polygon)){
					deliverble.push(loc);
					return;
				}
			}
			else{
				let location_1 = {lat: loc.lat_long[0].lat, lon: loc.lat_long[0].long}
				let location_2 = {lat: lat_long[0], lon: lat_long[1]};
				let diff = headingDistanceTo(location_1, location_2);
				console.log("radius diff==>", diff);
				if(diff.distance < loc.radius){
					deliverble.push(loc);
					return;
				}
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
		cart_data.summary.you_pay 			+= item.attributes.sale_price * item.quantity;
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

		for (const order_line of order_line_items) {
			let product = await firestore.collection('products').doc(order_line.product_id).get();
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
		      	availability : true,
		      	quantity : order_line.quantity,
		      	timestamp : order_line.timestamp
			}
			items.push(item);
		}

		if(cart.exists){
			let response = {
				success: true, 
				cart : cart.data(),
				delivery_address : {
				    address : "Panjim Convetion Center, Panjim Goa"
				},
				coupon_applied: null,
				coupons: [],
				approx_delivery_time : "40 mins"
			}
			response.cart.items = items;
			return res.status(200).send(response);
		}
		return res.status(400).send({ success: false, message: 'cart not found'});		
	},

	getNewCartData : (lat_long) => {
		let cart_data : any = {
			user_id : '',
			summary : {
				mrp_total : 0,
				sale_price_total : 0,
				cart_discount : 0,
				you_pay : 0,
				shipping_fee : 0,
			},
			order_type : 'cart',
			cart_count : 0,
			lat_long : lat_long
		}
		return cart_data;
	}
}

export default Order;