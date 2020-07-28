import * as admin from 'firebase-admin';
import { Request, Response } from "express";
const config = require('../../config.json');
const cred = require('../../credentials.json');


let Cart = {

	addCouponToCart: async (userObj: any, cartObj: any, couponObj: any) => {
		let result = {
			success: false,
			code: "",
			message: "",
			data: { "cart": cartObj }
		};

		let updatedCartObj = cartObj;

		let couponValidCheck = await Cart.validateCoupon(userObj, cartObj, couponObj) //NUTAN

		if (couponValidCheck['success'] === true) {
			let discountSummary = Cart.calculatCouponDiscount(cartObj, couponObj) //LATESH

			updatedCartObj["applied_coupon"] = couponObj
			updatedCartObj["summary"] = discountSummary

			Cart.updateCartCoupon(cartObj); //update to firestore with latest cart object

			result["success"] = true
			result["code"] = "COUPON_ADD_SUCCESS"
			result["message"] = "Coupon added successfully"
			result["data"]["cart"] = updatedCartObj
		}
		else {
			result["code"] = couponValidCheck["code"]
			result["message"] = couponValidCheck["message"]
		}

		return result
	},

	//LATESH
	removeCouponFromCart: (userObj: any, cartObj: any, couponObj: any) => {
		let result = {
			success: false,
			code: "",
			message: "",
			data: { "cart": cartObj }
		};

		let updatedCartObj = JSON.parse(JSON.stringify(cartObj));

		updatedCartObj["applied_coupon"] = {}
		updatedCartObj["summary"] = Cart.calculatCouponDiscount(cartObj, {})

		Cart.updateCartCoupon(updatedCartObj); //update to firestore with latest cart object
		result.success = true
		result.data.cart = updatedCartObj
		return result
	},


	//LATESH
	modifyCouponBasedCart: async (userObj: any, cartObj: any, couponObj: any) => {
		let result = {
			success: false,
			code: "",
			message: "",
			data: { "cart": cartObj }
		};
		let couponValidCheck = await Cart.validateCoupon(userObj, cartObj, couponObj) 
		let couponObjCp = JSON.parse(JSON.stringify(couponObj))
		if(!couponValidCheck["success"]) {
			couponObjCp = {}
		}
		let updatedCartObj = cartObj;

		//1. check if cart has coupon applied

		//1.2. call validatecoupon method if coupon applied and modify cart  


		updatedCartObj["applied_coupon"] = couponObjCp
		updatedCartObj["summary"] = Cart.calculatCouponDiscount(cartObj,couponObjCp)

		Cart.updateCartCoupon(updatedCartObj); //update to firestore with latest cart object
		result.data.cart = updatedCartObj
		return result
	},

	validateCart: async (userId: string, cartId: string, couponCode: string, operation: string) => {
		let firestore = admin.firestore();
		let couponObj: any = {};
		let userObj: any = {};
		let cartObj: any = {};

		let validatedResponse: any = {
			success: false,
			code: "CART_NOT_VALIDATED",
			message: "Cart not Validated",
			data: { "cart": {} }
		};


		//get user
		let user = await firestore.collection('user-details').doc(userId).get();
		if (user.exists) {
			userObj = user.data();
			userObj.id = userId
		}
		else {
			validatedResponse['code'] = "USER_NOT_EXIST";
				validatedResponse['message'] = "User does not exist"

			return validatedResponse
		}

		//get cart


		let cart = await firestore.collection('carts').doc(cartId).get();
		if (cart.exists) {
			cartObj = cart.data();
			cartObj.cartId = cartId
			validatedResponse['data']['cart'] = cartObj
		}
		else {
			validatedResponse['code'] = "CART_NOT_EXIST";
				validatedResponse['message'] = "Cart does not exist"

			return validatedResponse
		}

		// get coupon
		if (couponCode) {
			let couponCodeTransform = couponCode.toUpperCase() // user can enter in any case, code will be converted to uppercase to query in the DB
			const couponRes = await firestore.collection('coupons').where("code", "==", couponCodeTransform).where("active", "==", true).get(); //query coupon @todo 
			if (couponRes.empty) {
				validatedResponse['code'] = "COUPON_NOT_EXIST";
					validatedResponse['message'] = "Coupon does not exist"
				return validatedResponse
			} else {
				const couponRef = couponRes.docs[0]
				couponObj = couponRef.data()
			}
		}
		else if(operation =="add" && !couponCode) { //to handle request which does doesnt pass code
			validatedResponse['code'] = "COUPON_NOT_EXIST";
				validatedResponse['message'] = "Coupon does not exist"

			return validatedResponse
		}


		//if cart belongs to user then only proceed to add/remove/modify coupon based cart
		if (Cart.cartBelongsToUser(userObj, cartObj)) {

			switch (operation) {
				case "add":
					validatedResponse = Cart.addCouponToCart(userObj, cartObj, couponObj)
					break;

				case "remove":
					validatedResponse = Cart.removeCouponFromCart(userObj, cartObj, couponObj)
					break;

				case "validate_cart":
					couponObj = cartObj["applied_coupon"]
					validatedResponse = Cart.validateCoupon(userObj, cartObj, couponObj)
					break;


				case "modify_cart":
					couponObj = cartObj["applied_coupon"]
					validatedResponse = Cart.modifyCouponBasedCart(userObj, cartObj, couponObj)
					break;

			}

		}
		else {
			validatedResponse['code'] = "CART_NOT_OF_USR";
				validatedResponse['message'] = "Requested Cart does not belong to user"

			return validatedResponse
		}




		return validatedResponse
	},

	cartBelongsToUser: (userObj: any, cartObj) => {
		return userObj.id == cartObj.user_id;
	},

	validateCoupon: (userObj, cartObj, couponObj) => {
		return { success: true, message: "Coupon applied succesfully.", data: { "cart": cartObj} }
	},

	updateCartCoupon: (cartObj) => {
		const firestore = admin.firestore();
		const cartId = cartObj.cartId
		delete cartObj.cartId

		firestore.collection("carts").doc(cartId).update(cartObj).then(() => {
			console.log(`updated cart ${cartId}`)
		}).catch((e) => {
			console.log(`error in update ${cartId}`,e);
			
		})
		
	},

	calculatCouponDiscount(cartObj, couponObj) {
		const { coupon_type="", discount_type ="", discount_value = 0 } = couponObj
		let newDiscount = 0 , newYouPay = 0;
		switch (coupon_type) {
			case "cart_level":
				switch (discount_type) {
					case "percentage":
						newDiscount = cartObj.summary.sale_price_total * ( discount_value / 100)
						newYouPay = cartObj.summary.sale_price_total - newDiscount + cartObj.summary.shipping_fee;
						cartObj.summary.cart_discount = newDiscount
						cartObj.summary.you_pay = newYouPay
						break;
					case "flat":
						newYouPay = cartObj.summary.sale_price_total - discount_value + cartObj.summary.shipping_fee;
						cartObj.summary.cart_discount = discount_value
						cartObj.summary.you_pay = newYouPay
						break;
					default:
						break;
				}

				break;

			default:
				newYouPay = cartObj.summary.sale_price_total + cartObj.summary.shipping_fee;
				cartObj.summary.cart_discount = 0
				cartObj.summary.you_pay = newYouPay
				break;
		}
		return cartObj.summary
	},

	reCalculate: async (req: Request, res: Response) => {

		try {
			let { uid="", cartId, couponCode = null, operation = null } = req.body
			let responseData = {}

			//1. @todo fetch user from request already appended via the authenticate method and pass in method to recalculate cart
			console.log("request details ==>", uid, cartId, couponCode, operation)


			responseData = await Cart.validateCart(uid, cartId, couponCode, operation) //{ success: true, message: 'Coupon Applied successfully', data : {}}


			return res.status(200).send(responseData)

		} catch (error) {
			console.log(error)
			return res.status(200).send({ success: false, message: 'Error in applying coupon', data: error })
		}

	}
}

export default Cart;