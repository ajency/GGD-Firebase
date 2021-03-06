const { Engine } = require("json-rules-engine")
const { _ } = require("underscore")
import * as admin from 'firebase-admin';
import * as errorJson from './coupon-messages.json';

let couponUtil = {

	validateCoupon: async (userObj, cartObj, couponObj, miscData, operation="") => {

		/**	
		 * Create an Engine	
		 */
		let couponRuleEngine = new Engine();


		/**	
		 * Add Rules	
		 */
		let event = {  // define the event to fire when the conditions evaluate truthy 
			type: 'calculateCouponDiscount',
			params: {
				userObj: userObj,
				cartObj: cartObj,
				couponObj: couponObj,
				miscData: miscData,
				operation

			}
		};

		let conditions = couponObj.rules;
		let rule = { conditions, event, priority: 10, name: 'applyCouponRules' };
		couponRuleEngine.addRule(rule);


		/**
		 * Define facts the engine will use to evaluate the conditions above.
		 * Facts may also be loaded asynchronously at runtime; see the advanced example below
		 */
		let facts = couponUtil.prepareCouponFacts(userObj, cartObj, couponObj, miscData)


		/**
		 * Run Engine
		*/
		couponRuleEngine.run(facts)
		return await couponUtil.ruleEnginePromise(couponRuleEngine);




	},

	ruleEnginePromise: async (couponRuleEngine) => {
		return new Promise(function (resolve, reject) {

			/**
		 	* Handling Rule Events
			*/

			// Do async job
			// subscribe to any event emitted by the engine
			couponRuleEngine.on('success', function (event, almanac, ruleResult) {
				console.log("Success resolve\n")
				couponUtil.logCouponActivity(event.params.userObj, event.params.cartObj, event.params.couponObj, event.params.miscData, event.params.operation,ruleResult, "success")
				resolve(couponUtil.processRuleResult(true, ruleResult, event));
			});

			couponRuleEngine.on('failure', function (event, almanac, ruleResult) {
				console.log("Failure reject\n")
				couponUtil.logCouponActivity(event.params.userObj, event.params.cartObj, event.params.couponObj, event.params.miscData, event.params.operation,ruleResult, "failure")
				resolve(couponUtil.processRuleResult(false, ruleResult, event));
			});

		})
	},


	processRuleResult: (success = false, ruleResult, event) => {

		let processedRuleResult: any = {};
		let allFailedConditions: any = [];
		let anyFailedConditions: any = [];
		let failedConditionFacts: any = [];
		let failedRuleList: any = [];
		let message: String = "";

		switch (success) {
			case true:

				processedRuleResult["success"] = true;
				processedRuleResult["code"] = event.params.couponObj.success.code;
				processedRuleResult["message"] = event.params.couponObj.success.message;
				processedRuleResult["formatted_message"] = event.params.couponObj.success.formatted_message;
				console.log(`Inside RULE ENGINE SUCCESS\n ruleResult = ${JSON.stringify(processedRuleResult)}`)
				return processedRuleResult

				break;

			case false:

				if (ruleResult.conditions.all) {
					allFailedConditions = _.where(ruleResult.conditions.all, { result: false });
				}
				if (ruleResult.conditions.any) {
					anyFailedConditions = _.where(ruleResult.conditions.any, { result: false });
				}

				failedConditionFacts = _.pluck(allFailedConditions.concat(anyFailedConditions), 'fact')
				console.log(`Inside RULE ENGINE FAILURE\n ruleResult = ${JSON.stringify(failedConditionFacts)}`)


				failedRuleList = _.filter(event.params.couponObj.rules.all, function (ruleObj) {
					return failedConditionFacts.includes(ruleObj.fact);
				});

				processedRuleResult["success"] = false;
				processedRuleResult["code"] = failedRuleList[0]['fact'];
				processedRuleResult["message"] = failedRuleList[0]['error']['message'];
				processedRuleResult["formatted_message"] = failedRuleList[0]['error']['formatted_message'];

				return processedRuleResult

				break;

		}




	},


	validateCouponCode: (userObj, cartObj, operation, couponCode) => {

		let validatedResponse: any = {
			success: false,
			code: "COUPON_EMPTY_CHECK_PENDING",
			message: "Input coupon not checked for empty validation",
			couponCode: couponCode
		};

		//extract coupon code to be used
		switch (operation) {
			case "add":
				if (couponCode) {
					validatedResponse.code = errorJson["ADD_COUPON_CODE_NOT_EMPTY"].code
					validatedResponse.message = errorJson["ADD_COUPON_CODE_NOT_EMPTY"].message

					validatedResponse.couponCode = couponCode.toUpperCase()
					validatedResponse.success = true
				}
				else {
					validatedResponse.code = errorJson["ADD_COUPON_CODE_EMPTY"].code
					validatedResponse.message = errorJson["ADD_COUPON_CODE_EMPTY"].message
				}
				break;

			case "remove":
				if (couponCode) {
					validatedResponse.code = errorJson["REMOVE_COUPON_CODE_NOT_EMPTY"].code
					validatedResponse.message = errorJson["REMOVE_COUPON_CODE_NOT_EMPTY"].message

					validatedResponse.couponCode = couponCode.toUpperCase()
					validatedResponse.success = true
				}
				else {
					if (_.isEmpty(cartObj["applied_coupon"])) {
						validatedResponse.code = errorJson["REMOVE_COUPON_CODE_EMPTY"].code
						validatedResponse.message =  errorJson["REMOVE_COUPON_CODE_EMPTY"].message
					} else {
						if (cartObj["applied_coupon"]["code"]) {
							validatedResponse.code = errorJson["ADD_COUPON_CODE_NOT_EMPTY"].code
							validatedResponse.message =  errorJson["ADD_COUPON_CODE_NOT_EMPTY"].message

							validatedResponse.couponCode = cartObj["applied_coupon"]["code"]
							validatedResponse.success = true
						}
						else {
							validatedResponse.code = errorJson["REMOVE_COUPON_CODE_EMPTY"].code
							validatedResponse.message = errorJson["REMOVE_COUPON_CODE_EMPTY"].message
						}
					}

				}
				break;

			default:

				if (_.isEmpty(cartObj["applied_coupon"])) {
					validatedResponse.code = errorJson["EMPTY_COUPON_AGAINST_CART"].code
					validatedResponse.message = errorJson["EMPTY_COUPON_AGAINST_CART"].message

					validatedResponse.couponCode = ""
					validatedResponse.success = true
				} else {
					if (cartObj["applied_coupon"]["code"]) {
						validatedResponse.code = errorJson["COUPON_CODE_NOT_EMPTY"].code
						validatedResponse.message =  errorJson["COUPON_CODE_NOT_EMPTY"].message

						validatedResponse.couponCode = (cartObj["applied_coupon"]["code"]).toUpperCase()
						validatedResponse.success = true
					}
					else {
						validatedResponse.code = errorJson["EMPTY_COUPON_AGAINST_CART"].code
						validatedResponse.message = errorJson["EMPTY_COUPON_AGAINST_CART"].message
					}
				}

		}

		return validatedResponse


	},

	prepareCouponFacts: (userObj, cartObj, couponObj, miscData) => {

		// Any time a new rule is added, the new attribute/fact and the way to fetch it must be defined here
		let couponFacts = {
			COUPON_INACTIVE: couponUtil.isCouponActive(userObj, cartObj, couponObj, miscData), //default rule in any coupon
			VALID_FROM: couponUtil.getDateOfApplication(userObj, cartObj, couponObj, miscData),
			VALID_TO: couponUtil.getDateOfApplication(userObj, cartObj, couponObj, miscData),
			USAGE_LIMIT: couponUtil.getUsageCount(userObj, cartObj, couponObj, miscData),
			EXCLUDE_USER_PHONES: couponUtil.getUserPhone(userObj, cartObj, couponObj, miscData),
			INCLUDE_USER_PHONES: couponUtil.getUserPhone(userObj, cartObj, couponObj, miscData),
			TOTAL_ORDER:couponUtil.getTotalUserOrderCount(userObj, cartObj, couponObj, miscData)

		}

		console.log(couponFacts)

		return couponFacts


	},

	isCouponActive: (userObj, cartObj, couponObj, miscData) => {

		if (couponObj.active) {
			return "true"
		}
		else {
			return "false"
		}
	},

	getDateOfApplication: (userObj, cartObj, couponObj, miscData) => {
		const date = new Date();
		const timestamp = date.getTime();

		return timestamp
	},

	getUsageCount: (userObj, cartObj, couponObj, miscData) => {

		let usageCount: number = 0;

		if (miscData.couponRedeemCount) {
			usageCount = miscData.couponRedeemCount
		}

		return usageCount
	},

	getUserPhone: (userObj, cartObj, couponObj, miscData) => {
		let userPhone: string = ""
		if (userObj.phone) {
			userPhone = userObj.phone
		}

		return userPhone
	},
	getTotalUserOrderCount:(userObj, cartObj, couponObj, miscData) => {
		return miscData.totalOrderCount || 0
	},

	calculatCouponDiscount(cartObj, couponObj) {
		const { coupon_type = "", discount_type = "", discount_value = 0 } = couponObj
		let newDiscount = 0, newYouPay = 0;
		switch (coupon_type) {
			case "cart_level":
				switch (discount_type) {
					case "percentage":
						newDiscount = Math.round(cartObj.summary.sale_price_total * (discount_value / 100))
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

	getFormattedMessage: (operation, cartObj, msgType, message) => {
		let msg = ""

		switch (operation) {
			case "add":
				if (msgType == "success")
					msg = `<div class="msg-success"><p>Nicely done! You've saved ₹<span>${cartObj.summary.cart_discount}</span> on your order.</p></div>`
				else
					msg = `<div class="msg-error"><p>${message}</p></div>`
				break;

			default:
				if (msgType == "success")
					msg = `<div class="msg-success"><p>${message}</p></div>`
				else
					msg = `<div class="msg-error"><p>${message}</p></div>`
				break;

		}
		
		return msg
	},

	logCouponActivity: (userObj:any = {}, cartObj:any = {}, couponObj:any = {}, miscData:any = {}, operation:string = "",ruleResult:any={}, status:string) => {
		let allFailedConditions = [], anyFailedConditions=[];
		if (ruleResult.conditions.all) {
			allFailedConditions = _.where(ruleResult.conditions.all);
		}
		if (ruleResult.conditions.any) {
			anyFailedConditions = _.where(ruleResult.conditions.any);
		}
		let finalResult = _.map(allFailedConditions.concat(anyFailedConditions),(cond:any) => {return { ...cond } });
		
		const db = admin.firestore()
		let couponActivity = {
			user_id: userObj.id,
			user_phone: userObj.phone,
			operation,
			coupon_code:couponObj.code,
			couponobj:couponObj,
			cartObj:cartObj,
			misc_obj:miscData,
			status,
			ruleResult:finalResult,
			timestamp:admin.firestore.FieldValue.serverTimestamp()
		}

		db.collection("coupon_rules_log").doc().set(couponActivity).then(() => {
			console.log("log updated");
		}).catch((e) => {
			console.log("log entry failed");
			
		})
		return 
	}



}


export default couponUtil;
