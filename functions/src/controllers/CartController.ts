import { Request, Response } from "express";
// import * as admin from 'firebase-admin';
import Products from './ProductController';
import Locations from './LocationsController';


export async function addToCart(req: Request, res: Response) {
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
            console.log("locations ==>", locations);
            return res.status(200).send({ success: true, message: 'Successfully added to cart'});
         }
          else
            return res.status(200).send({ success: false, message: 'Product is not available'});
       }
       else{
         return res.status(200).send({ success: false, message: 'Variant Not found'});
       }

   } catch (err) {
       return handleError(res, err)
   }
}

function handleError(res: Response, err: any) {
   return res.status(500).send({ message: `${err.code} - ${err.message}` });
}