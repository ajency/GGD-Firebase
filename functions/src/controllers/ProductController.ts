import * as admin from 'firebase-admin';
import { Request, Response } from "express";

let Products = {

	getVariantById: async (id: string) => {
		let firestore = admin.firestore();
		let variant = await firestore.collection('variants').doc(id).get();
		if (variant.exists){
			return variant.data();
		}
		else{
			return null;
		}
	},

	getProductById: async (id: string) => {
		let firestore = admin.firestore();
		let product = await firestore.collection('products').doc(id).get();
		if (product.exists){
			return product.data();
		}
		else{
			return null;
		}
	},

	getVariants: async (req: Request, res: Response) => {
		const product_id = req.query.product_id
		let firestore = admin.firestore();

		let variants_ref = await firestore.collection('variants')
			.where("product_id", "==", product_id)
			.where("active", "==", true)
			.get();
		let variants = variants_ref.docs.map(doc => {
			let obj = doc.data();
			obj.id = doc.id
			return obj;
		});

		return res.status(200).send({ success: true, variants : variants });
	},

	fetchProducts: async (req:Request, res:Response) => {
		const db = admin.firestore();
		const result = {
			code:"",
			message:"",
			success:false,
			data: {
				products:[]
			}
		}
		try {
			const products = await db.collection('products').get();	
			if(products.empty) {
				result.code = "NO_PRODUCT_FOUND";
				result.message = "Sold out"
				result.success = false
				return res.status(200).send(result)
			} else {
				result.code = "PRODUCTS_FOUND";
				result.success = true
				for (const key in products.docs) {
					const productData = products.docs[key].data()
					result.data.products.push(productData);
				}
				return res.status(200).send(result)
			}
		} catch (error) {
			console.log(error);
			result.code = "ERROR_IN_FETCHING";
			result.message = "Something went wrong."
			result.success = false
			return res.status(200).send(result)
		} 
	},
}

export default Products;