import * as admin from 'firebase-admin';


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
	}
}

export default Products;