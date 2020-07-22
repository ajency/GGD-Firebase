import * as admin from 'firebase-admin';
import { Request, Response } from "express";
const config = require('../../config.json');
const cred = require('../../credentials.json');


let Cart = {

	addCouponToCart: async (userObj:any ,cartObj:any ,couponObj:any) =>{
		let result = {
			success: false,
			code: "",
			message: "",
			data: {"cart" : cartObj}
		};

		let updatedCartObj = cartObj;

		let couponValidCheck = await Cart.validateCoupon(userObj, cartObj, couponObj) //NUTAN

		if(couponValidCheck['success'] === true){
			let discountSummary = Cart.calculatCouponDiscount(cartObj, couponObj) //LATESH
			
			updatedCartObj["applied_coupon"] = couponObj
			updatedCartObj["summary"] = discountSummary

			Cart.updateCartCoupon(cartObj); //update to firestore with latest cart object

			result["success"] = true
			result["code"] = "COUPON_ADD_SUCCESS"
			result["message"] = "Coupon added successfully"
			result["data"]["cart"] = updatedCartObj
		} 
		else{
			result["code"] = couponValidCheck["code"]
			result["message"] = couponValidCheck["message"]
		}

		return result
	},

	//LATESH
	removeCouponFromCart: (userObj:any ,cartObj:any ,couponObj:any) =>{ 
		let result = {
			success: false,
			code: "",
			message: "",
			data: {"cart" : cartObj}
		};

		let updatedCartObj = cartObj;

		updatedCartObj["applied_coupon"] = couponObj
		updatedCartObj["summary"] = discountSummary

		Cart.updateCartCoupon(updatedCartObj); //update to firestore with latest cart object

		return result
	},


	//LATESH
	modifyCouponBasedCart: (userObj:any ,cartObj:any ,couponObj:any) =>{ 
		let result = {
			success: false,
			code: "",
			message: "",
			data: {"cart" : cartObj}
		};

		let updatedCartObj = cartObj;

		//1. check if cart has coupon applied

		//1.2. call validatecoupon method if coupon applied and modify cart  


		updatedCartObj["applied_coupon"] = couponObj
		updatedCartObj["summary"] = discountSummary

		Cart.updateCartCoupon(updatedCartObj); //update to firestore with latest cart object

		return result
	},

	validateCart: async (userId:string, cartId:string, couponCode:string, operation:string) => {
		let firestore = admin.firestore();
		let couponObj:any = {};
		let userObj:any = {};
		let cartObj:any = {};

		let validatedResponse:any = {
			success: false,
			code: "CART_NOT_VALIDATED",
			message: "Cart not Validated",
			data: {"cart" : {}}
		};


		//get user
		let user = await firestore.collection('user-details').doc(userId).get();
		if (user.exists){
			userObj =  user.data();
			userObj.id = user.id
		}
		else{
			validatedResponse['code'] = "USER_NOT_EXIST",
			validatedResponse['message'] = "User does not exist"

			return validatedResponse
		}

		//get cart


		let cart = await firestore.collection('cartId').doc(userId).get();
		if (cart.exists){
			cartObj =  cart.data();
			validatedResponse['data']['cart'] = cartObj
		}
		else{
			validatedResponse['code'] = "CART_NOT_EXIST",
			validatedResponse['message'] = "Cart does not exist"
			
			return validatedResponse			
		}

		// get coupon
		if(couponCode){
			const couponRes = await firestore.collection('coupons').where("code", "==",couponCode).where("active","==", true).get(); //query coupon @todo 
			if(couponRes.empty) {
				validatedResponse['code'] = "COUPON_NOT_EXIST",
				validatedResponse['message'] = "Coupon does not exist"
				return validatedResponse	
			} else {
				const couponRef = couponRes.docs[0]
				couponObj = couponRef.data() 
			}
		}
		else{
			validatedResponse['code'] = "COUPON_NOT_EXIST",
			validatedResponse['message'] = "Coupon does not exist"

			return validatedResponse			
		}
		

		//if cart belongs to user then only proceed to add/remove/modify coupon based cart
		if(Cart.cartBelongsToUser(userObj, cartObj)){

			switch (operation) {
			    case "add":
			        validatedResponse = Cart.addCouponToCart(userObj,cartObj,couponObj)
			        break;

			    case "remove":
			        validatedResponse = Cart.removeCouponFromCart(userObj,cartObj,couponObj)
			        break;

	    		case "validate":
			    	couponObj = cartObj["applied_coupon"]
			        validatedResponse = Cart.modifyCouponBasedCart(userObj,cartObj, couponObj)
			        break;


			    case "modify_cart":
			    	couponObj = cartObj["applied_coupon"]
			        validatedResponse = Cart.modifyCouponBasedCart(userObj,cartObj, couponObj)
			        break;

			}

		} 
		else{
			validatedResponse['code'] = "CART_NOT_OF_USR",
			validatedResponse['message'] = "Requested Cart does not belong to user"

			return validatedResponse
		}




		return validatedResponse
	},

	cartBelongsToUser: (userObj:any, cartObj) => {
		return userObj.id == cartObj.user_id;
	},

	validateCoupon: (userObj, cartObj, couponObj) => {
		return { success: true}
	},

	updateCartCoupon: (cartObj) => {

	},

	calculatCouponDiscount(cartObj, couponObj) {
		return cartObj.summary
	},

	reCalculate: async (req:Request, res:Response) => {

		try {
			let {uid, cartId, couponCode=null, operation=null } = req.body
			let responseData = {}
			
			//1. @todo fetch user from request already appended via the authenticate method and pass in method to recalculate cart
			console.log("request details ==>", uid, cartId, couponCode, operation)


			responseData = Cart.validateCart(uid, cartId, couponCode, operation) //{ success: true, message: 'Coupon Applied successfully', data : {}}

			
			return res.sendStatus(200).send(responseData)

		} catch (error) {
			console.log(error)
			return res.status(200).send({ success: false, message: 'Error in applying coupon', data : error})
		}

	}	
}

export default Cart;