import * as admin from 'firebase-admin';
import { Request, Response } from "express";
import couponUtil from '../utils/CouponUtil';
import * as errorJson from '../utils/coupon-messages.json';
const { _ } = require("underscore");


let Cart = {

	reCalculate: async (req: Request, res: Response) => {

		try {
			let { uid="", cartId, couponCode = null, operation = null } = req.body
			console.log(`Request body ${JSON.stringify(req.body)}`)
			let responseData = {}

			responseData = await Cart.validateCart(uid, cartId, couponCode, operation)
			return res.status(200).send(responseData)

		} catch (error) {
			return res.status(200).send({ success: false, message: 'Error in applying coupon', data: error })
		}

	},

	validateCart: async (userId: string, cartId: string, couponCode: string, operation: string) => {
		let firestore = admin.firestore();
		let couponObj: any = {};
		let userObj: any = {};
		let cartObj: any = {};
		let finalCouponCodeData: any = {};
		let miscData : any = {"couponRedeemCount": 0};
		let validatedCouponCode: String = "";

		let validatedResponse: any = {
			success: false,
			code: errorJson["CART_NOT_VALIDATED"].code,
			message: errorJson["CART_NOT_VALIDATED"].message,
			data: { "cart": {} }
		};


		//get user
		let user = await firestore.collection('user-details').doc(userId).get();
		
		if (user.exists) {
			userObj = user.data();
			console.log(`User details exists ${JSON.stringify(userObj)}`)
			userObj.id = userId
		}
		else {
			validatedResponse['code'] = errorJson["USER_NOT_EXIST"].code;
			validatedResponse['message'] = errorJson["USER_NOT_EXIST"].message

			return validatedResponse
		}

		//get cart
		let cart = await firestore.collection('carts').doc(cartId).get();

		if (cart.exists) {
			cartObj = cart.data();
			console.log(`Cart exists\n ${JSON.stringify(cartObj)}`)
			if(!cartObj.created_at){
				console.log(`Active Cart does not exist\n`)
				validatedResponse['code'] = errorJson["ACTIVE_CART_NOT_EXIST"].code;
				validatedResponse['message'] = errorJson["ACTIVE_CART_NOT_EXIST"].message;
				validatedResponse['data']['cart'] = cartObj;

				return validatedResponse
			}
			cartObj.cartId = cartId
			validatedResponse['data']['cart'] = cartObj
		}
		else {
			console.log(`Cart does not exist\n`)
			validatedResponse['code'] = errorJson["CART_NOT_EXIST"].code;
			validatedResponse['message'] = errorJson["CART_NOT_EXIST"].message

			return validatedResponse
		}

		if (!Cart.cartBelongsToUser(userObj, cartObj)){
			validatedResponse['code'] = errorJson["CART_NOT_OF_USR"].code;
			validatedResponse['message'] = errorJson["CART_NOT_OF_USR"].message

			return validatedResponse
		}

		finalCouponCodeData = couponUtil.validateCouponCode(userObj, cartObj, operation, couponCode)

		if(!finalCouponCodeData["success"]){
			validatedResponse['code'] = finalCouponCodeData['code']
			validatedResponse['message'] = finalCouponCodeData['message']
			return validatedResponse		
		}else{
			if(!finalCouponCodeData["couponCode"]){
				validatedResponse['success'] = finalCouponCodeData['success']
				validatedResponse['code'] = finalCouponCodeData['code']
				validatedResponse['message'] = finalCouponCodeData['message']
				return validatedResponse
			}
			else{
				validatedCouponCode = finalCouponCodeData['couponCode']
			}
		}

		console.log(`Final validated coupon code ${validatedCouponCode}`)

		
		const couponRes = await firestore.collection('coupons').where("code", "==", validatedCouponCode).get(); 

		if (couponRes.empty) {
			console.log(`Coupon does not exist\n`)
			validatedResponse['code'] = errorJson["COUPON_NOT_EXIST"].code;
			validatedResponse['message'] = errorJson["COUPON_NOT_EXIST"].message
			return validatedResponse
		} else {
			const couponRef = couponRes.docs[0]
			couponObj = couponRef.data()
			console.log(`Coupon exists \n ${JSON.stringify(couponObj)}`)
		}

		// find number of times coupon is redeemed by user
	
		miscData = await Cart.getMiscData(cartObj,couponObj,userObj)


		console.log("here ====>",miscData);
		

		//if coupon is found to be active, then do the intended operation
		switch (operation) {
			case "add":
				validatedResponse = Cart.addModifyCouponBasedCart(userObj, cartObj, couponObj, miscData, operation)
				break;

			case "remove":
				validatedResponse = Cart.removeCouponFromCart(userObj, cartObj, couponObj, miscData)
				break;

			case "validate_cart":				
				validatedResponse = couponUtil.validateCoupon(userObj, cartObj, couponObj, miscData, operation)
				break;


			case "modify_cart":
				validatedResponse = Cart.addModifyCouponBasedCart(userObj, cartObj, couponObj, miscData, operation)
				break;

		}


		return validatedResponse
	},	


	addModifyCouponBasedCart: async (userObj: any, cartObj: any, couponObj: any, miscData: any, operation:string) => {

		let result = {
			success: false,
			code: "",
			message: "",
			data: { "cart": cartObj }
		};


		let couponValidCheck = await couponUtil.validateCoupon(userObj, cartObj, couponObj, miscData, operation) 
		let couponObjCp = JSON.parse(JSON.stringify(couponObj))

		let updatedCartObj = cartObj;

		result["success"] = couponValidCheck["success"]
		result["code"] = couponValidCheck["code"]
		result["message"] = couponValidCheck["message"]	
		if(couponValidCheck["success"]) {
			updatedCartObj["applied_coupon"] = couponObjCp
			updatedCartObj["summary"] = couponUtil.calculatCouponDiscount(cartObj,couponObjCp)
			result["formatted_message"] = couponUtil.getFormattedMessage(operation,updatedCartObj, "success",couponValidCheck["message"] )
			Cart.updateCartCoupon(updatedCartObj); //update to firestore with latest cart object
			result.data.cart = updatedCartObj
		}else{
			updatedCartObj["applied_coupon"] = {}
			updatedCartObj["summary"] = couponUtil.calculatCouponDiscount(cartObj, {})
			result["formatted_message"] = couponUtil.getFormattedMessage(operation,updatedCartObj, "error",couponValidCheck["message"] )
			Cart.updateCartCoupon(updatedCartObj)
			result.data.cart = updatedCartObj
		}

		return result;

	},

	removeCouponFromCart: (userObj: any, cartObj: any, couponObj: any, miscData: any) => {
		let result = {
			success: false,
			code: "COUPON_REMOVE_NOT_PROCESSED",
			message: "Coupon removal not processed",
			data: { "cart": cartObj }
		};

		let updatedCartObj = JSON.parse(JSON.stringify(cartObj));

		updatedCartObj["applied_coupon"] = {}
		updatedCartObj["summary"] = couponUtil.calculatCouponDiscount(cartObj, {})

		Cart.updateCartCoupon(updatedCartObj); //update to firestore with latest cart object
		result.success = true
		result.data.cart = updatedCartObj
		result.code = "REMOVE_COUPON_SUCCESS"
		result.message = "Coupon removed successfully"			
		return result
	},




	cartBelongsToUser: (userObj: any, cartObj) => {
		return userObj.id == cartObj.user_id;
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

	getMiscData: (cartObj, couponObj, userObj) => {
		return new Promise(async (resolve,reject)=> {
			let fact =""
			let miscData = {}
			let allFailedConditions =[], anyFailedConditions=[]
			let firestore = admin.firestore()
			if (couponObj.rules.all) {
				allFailedConditions = _.where(couponObj.rules.all);
			}
			if (couponObj.rules.any) {
				anyFailedConditions = _.where(couponObj.rules.any);
			}

			let rulesFact = _.pluck(allFailedConditions.concat(anyFailedConditions), 'fact')
			
			for (const key in rulesFact) {
				
				switch (rulesFact[key]) {
					case "USAGE_LIMIT":
						console.log(rulesFact[key]);
						let couponsRedeemedRef = await firestore.collection('coupons_redeemed').where("user_phone", "==", userObj.phone).where("coupon_code", "==", couponObj.code).get();
				
						try{
							if (!couponsRedeemedRef.empty){
								miscData["couponRedeemCount"] = couponsRedeemedRef.size
								console.log(`Coupon redeemed count \n ${JSON.stringify(miscData["couponRedeemCount"])}`)
							}
						}
						catch(e){
							console.log(e)
						}
					break;
					case "TOTAL_ORDER":
						let ordersRef = await firestore.collection("user-details").doc(userObj.id).collection("orders").where("status","==","placed").get()
						miscData["totalOrderCount"] = ordersRef.size
					break;
					default:
						break;
				}
			}
			console.log(miscData);
			
			resolve(miscData)
		})
	}


}

export default Cart;