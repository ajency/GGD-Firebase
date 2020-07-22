import * as admin from 'firebase-admin';
import { Request, Response } from "express";
const config = require('../../config.json');
const cred = require('../../credentials.json');


let Cart = {

	addCouponToCart: (userObj:any ,cartObj:any ,couponObj:any) =>{
		let result = {
			success: false,
			code: "",
			message: "",
			data: {"cart" : cartObj}
		};

		let updatedCartObj = cartObj;

		let couponValidCheck = await validateCoupon(userObj, cartObj, couponObj) //NUTAN

		if(couponValidCheck['success'] === true){
			let discountSummary = calculatCouponDiscount(cartObj, couponObj) //LATESH
			
			updatedCartObj["applied_coupon"] = couponObj
			updatedCartObj["summary"] = discountSummary

			updateCartCoupon(cartObj); //update to firestore with latest cart object

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
	}

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

		updateCartCoupon(updatedCartObj); //update to firestore with latest cart object

		return result
	}


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

		updateCartCoupon(updatedCartObj); //update to firestore with latest cart object

		return result
	}	

	validateCart: async (userId:string, cartId:string, couponId:string, operation:string) => {
		let firestore = admin.firestore();
		let couponObj = {};
		let userObj = {};
		let cartObj = {};

		let validatedResponse = {
			success: false,
			code: "CART_NOT_VALIDATED",
			message: "Cart not Validated",
			data: {"cart" : {}}
		};


		//get user
		let user = await firestore.collection('user-details').doc(id).get();
		if (user.exists){
			userObj =  user.data();
		}
		else{
			validatedResponse['code'] = "USER_NOT_EXIST",
			validatedResponse['message'] = "User does not exist"

			return validatedResponse
		}

		//get cart
		let cart = await firestore.collection('cartId').doc(id).get();
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
			let couponObj = await firestore.collection('couponId').doc(id).get(); //query coupon @todo
		}
		else{
			validatedResponse['code'] = "COUPON_NOT_EXIST",
			validatedResponse['message'] = "Coupon does not exist"

			return validatedResponse			
		}
		

		//if cart belongs to user then only proceed to add/remove/modify coupon based cart
		if(cartBelongsToUser(userObj, cartObj)){

			switch (operation) {
			    case "add":
			        validatedResponse = addCouponToCart(userObj,cartObj,couponObj)
			        break;

			    case "remove":
			        validatedResponse = removeCouponFromCart(userObj,cartObj,couponObj)
			        break;

	    		case "validate":
			    	couponObj = cartObj["applied_coupon"]
			        validatedResponse = modifyCouponBasedCart(userObj,cartObj, couponObj)
			        break;


			    case "modify_cart":
			    	couponObj = cartObj["applied_coupon"]
			        validatedResponse = modifyCouponBasedCart(userObj,cartObj, couponObj)
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

	reCalculate: async (req:Request, res:Response) => {

		try {
			let {uid, cartId, couponCode=null, operation=null } = req.body
			let responseData = {}
			
			//1. @todo fetch user from request already appended via the authenticate method and pass in method to recalculate cart
			console.log("request details ==>" uid, cartId, couponCode, operation)


			responseData = validateCart(uid, cartId, couponCode, operation) //{ success: true, message: 'Coupon Applied successfully', data : {}}

			
			return res.sendStatus(200).send(responseData)

		} catch (error) {
			console.log(error)
			return res.status(200).send({ success: false, message: 'Error in applying coupon', data : error})
		}

	}	
}

export default Cart;