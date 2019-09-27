import { Request, Response } from "express";
import Products from './ProductController';
import Locations from './LocationsController';
import { insidePolygon } from 'geolocation-utils';

let Cart = {

	checkAvailability : async (req: Request, res: Response) => {
		 try {
				const { variant_id, quantity, lat_long } = req.body;

				 //if params are missing
				if (!variant_id || !quantity || !lat_long) {
						return res.status(400).send({ message: 'Missing fields' })
				}

				let variant = await Products.getVariantById(variant_id);
				if(variant){
					let product = await Products.getProductById(variant.product_id);
					if(product && product.active){
						let locations = await Locations.getLocations(variant_id, quantity);
						if(locations && locations.length){
							if(Cart.isDeliverable(locations, lat_long)){
								let item = {
									attributes : {
										title : product.title,
										images : product.image_url,
										size : variant.size,
										mrp : variant.mrp,
										sale_price : variant.sale_price,
										discount_per : 0
									},
									quantity : quantity,
									variant_id : variant_id
								}
								return res.status(200).send({ success: true, message: 'Successfully added to cart', item : item});
							}
							else
								return res.status(200).send({ success: false, message: 'Not deliverable at your location'});
						}
						else
							return res.status(200).send({ success: false, message: 'Quantity not availble'});	
					}
					else
						return res.status(200).send({ success: false, message: 'Product is not available'});
				}
				else{
					 return res.status(200).send({ success: false, message: 'Variant Not found'});
				}

		} catch (err) {
				return Cart.handleError(res, err)
		}
	},

	 handleError : (res: Response, err: any) => {
		return res.status(500).send({ message: `${err.code} - ${err.message}` });
	},

	isDeliverable : (locations : Array<any>, lat_long : any) => {
		console.log("finding deliverableLocations");
		let deliverble = false;
		locations.forEach((loc)=>{
			let polygon = loc.lat_long.map(Object.values)
			if(insidePolygon(lat_long, polygon)){
				deliverble = true;
				return;
			}
		})
		return deliverble;
	}

}

export default Cart;