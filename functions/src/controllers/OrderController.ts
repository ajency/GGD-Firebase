import * as admin from 'firebase-admin';
import { Request, Response } from "express";
import Products from './ProductController';
import Locations from './LocationsController';
import { insidePolygon, headingDistanceTo } from 'geolocation-utils';

let Order = {

	checkAvailability : async (req: Request, res: Response) => {
		try {
				const { variant_id, quantity, lat_long, cart_id } = req.body;

				if (!variant_id || !quantity || !lat_long) {
						return res.status(400).send({ message: 'Missing fields' })
				}

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
				
				// if(deliverable_locations.legth > 1){
				// 	let closest = Cart.findCloset(deliverable_locations , lat_long)
				// }

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
					variant_id : variant_id
				}

				// for logged in user
				if(req.headers.authorization){
					// TODO : Verify cart with user
					return res.status(200).send({ success: true, message: 'Successfully added to cart', item : item});
				}
				else{
					if(cart_id){
						let cart = await Order.getOrderByID(cart_id);
						if(!cart)
							return res.status(400).send({ success: false, message: 'cart not found'});

						let order_data = await Order.updateOrder(item, cart_id);		
						let response : any = {
							success: true, 
							message: 'Successfully added to cart',
							item : item,
							summary : order_data.summary,
							cart_count : order_data.item_count
						}
						return res.status(200).send(response);
					}
					else{
						let order_data = await Order.createOrder(item);
						let response : any = {
							success: true, 
							message: 'Successfully added to cart',
							item : item,
							summary : order_data.summary,
							cart_id : order_data.id,
							cart_count : order_data.item_count
						}
						return res.status(200).send(response);
					}
				}

		} catch (err) {
				return Order.handleError(res, err)
		}
	},

	handleError : (res: Response, err: any) => {
		return res.status(500).send({ message: `${err.code} - ${err.message}` });
	},

	isDeliverable : (locations : Array<any>, lat_long : any) => {
		console.log("finding deliverableLocations");
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

	getOrderByID : async (cart_id : string) => {
		let firestore = admin.firestore();
		let cart = await firestore.collection('orders').doc(cart_id).get();
		if(cart.exists){
			return cart.data();
		}
		return null;
	},

	createOrder : async(item) => {
		let firestore = admin.firestore();
		let order_ref = firestore.collection('orders').doc();
		let order_data : any = {
			user_id : '',
			created_at : admin.firestore.FieldValue.serverTimestamp(),
			summary : {
				mrp_total : item.attributes.mrp * item.quantity,
				sale_price_total : item.attributes.sale_price * item.quantity,
				cart_discount : 0,
				you_pay : item.attributes.sale_price * item.quantity,
				shipping_fee : 0,
			},
			order_type : 'cart',
			item_count : item.quantity
		}
		let order_success = await order_ref.set(order_data);

		let order_line_ref = firestore.collection('order_line_items').doc();
		let order_line_data = {
			order_id : order_ref.id,
			variant_id : item.variant_id,
			quantity : item.quantity,
			product_name : item.attributes.title,
			description : item.attributes.description,
			mrp : item.attributes.mrp,
			sale_price : item.attributes.sale_price,
			veg : item.attributes.veg,
			size : item.attributes.size
		}

		let order_line_success = await order_line_ref.set(order_line_data);
		order_data.id = order_ref.id;
		return order_data;
	},

	updateOrder : async (item, cart_id) => {
		let firestore = admin.firestore();
		let cart = await firestore.collection('orders').doc(cart_id).get();
		if(cart.exists){
			let cart_data = cart.data();
			let order_lines = await firestore.collection('order_line_items')
					.where("order_id", "==", cart_id)
					.where("variant_id", "==", item.variant_id)
					.get();

			let result = [];
			order_lines.forEach(doc => {
				let obj = doc.data();
				obj.id = doc.id;
				result.push(obj);
			})
			if(result.length){
				await firestore.collection('order_line_items').doc(result[0].id).update({quantity : result[0].quantity + item.quantity})
			}
			else{
				let order_line_ref = firestore.collection('order_line_items').doc();
				let order_line_data = {
					order_id : cart_id,
					variant_id : item.variant_id,
					quantity : item.quantity,
					product_name : item.attributes.title,
					description : item.attributes.description,
					mrp : item.attributes.mrp,
					sale_price : item.attributes.sale_price,
					veg : item.attributes.veg,
					size : item.attributes.size
				}
				let order_line_success = await order_line_ref.set(order_line_data);
			}

			let mrp_total = cart_data.summary.mrp_total + item.attributes.mrp * item.quantity;
			let sale_price_total = cart_data.summary.sale_price_total + item.attributes.sale_price * item.quantity;
			let you_pay = cart_data.summary.you_pay + item.attributes.sale_price * item.quantity;
			let item_count = cart_data.item_count + item.quantity;
			await firestore.collection('orders').doc(cart_id).update({
				item_count : item_count,
				'summary.mrp_total' : mrp_total,
				'summary.sale_price_total' : sale_price_total,
				'summary.you_pay' : you_pay,
			})

			let order_data : any = {
				summary : {
					mrp_total : mrp_total,
					sale_price_total : sale_price_total,
					cart_discount : 0,
					you_pay : you_pay,
					shipping_fee : 0,
				},
				item_count : item_count
			}
			return order_data;
		}
	},

	fetchCart : async (req: Request, res: Response) =>{
		let firestore = admin.firestore();

		let cart_id = req.query.cart_id
		console.log("cart_id");
		let cart = await firestore.collection('orders').doc(cart_id).get();
		if(cart.exists){
			return res.status(200).send({ success: true, cart : cart.data()});
		}
		return res.status(400).send({ success: false, message: 'cart not found'});		
	}
}

export default Order;