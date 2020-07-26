// import couponRules from '../utils/couponRules';
const { Engine } = require("json-rules-engine");

/*
  * if you need to make calls to additional tables, data stores (Redis, for example), 
  * or call an external endpoint as part of creating the blogpost, add them to this service
*/

// let couponUtil = {

//     validateCoupon: (userObj, cartObj, couponObj) => {
        
//         // console.log(`Inside VALIDATE COUPON\n coupon = ${JSON.stringify(couponObj, null, 4)}\n user = ${JSON.stringify(userObj, null, 4)}\n cart = ${JSON.stringify(cartObj, null, 4)}`)


// 		// Valid from. Valid to ------------------------------ primary field
//   	// Number of times it can be used -------------------- primary field
// 		// Specific to a user -------------------------------- part of rule
// 		// Applicable to all users flag - any user can use --- part of rule
// 		// Applicable to only these users - +ve list --------- part of rule
// 		// Applicable to all users except this  - -ve list --- part of rule





let couponUtil = {

	validateCoupon: async (userObj, cartObj, couponObj, miscData) => {


		/**
		 * Define facts the engine will use to evaluate the conditions above.
		 * Facts may also be loaded asynchronously at runtime; see the advanced example below
		 */
		let facts = couponUtil.prepareCouponFacts(userObj, cartObj, couponObj, miscData)


		//prepare rules object basis rules assigned to the coupon thati s being applied
		let couponRuleEngine = new Engine()

		const expiryRule = {
		
		conditions: {

			all: [
				{
					fact: 'dateofApplication',
					operator: 'greaterThanInclusive',
					value: new Date("2016-07-27T07:45:00Z").getTime() // "YYYY-MM-DDTHH:MM:SSZ" - ISO format and assumed UTC if timezone not passed
				}, 
				{
					fact: 'dateofApplication',
					operator: 'lessThanInclusive',
					value: new Date("2020-07-28T07:45:00Z").getTime()
				},
				{
					fact: 'usageCount',
					operator: 'lessThanInclusive',
					value: 5
				},
				{
					fact: 'userPhone',
					operator: 'notIn', // or notIn
					value: ["8806458310"]
				},

			]
		  },

			event: {  // define the event to fire when the conditions evaluate truthy
			    type: 'calculateCouponDiscount',
			    params: {
			      error: {
			      	code : 'EXPIRY_INVALID',
			      	message: "Validity of coupon has expired",
			      	formatted_message: "<div class='msg-error'><p>Please enter valid coupon code.</p></div>"
			      },
			      success: {
			      	code : 'EXPIRY_VALID',
			      	message: "Validity of coupon has expired",
			      	formatted_message: "<div class='msg-success'><p>Yay! coupon code applied successfully, You have availed discount of <span>₹ 100</span></p></div>"
			      }
			    }
		  	},

			priority : 1,
			name : 'expiryRule'
		}

		couponRuleEngine.addRule(expiryRule)

		// Run the engine to evaluate
		let ruleValidation =  await couponRuleEngine.run(facts)
		return ruleValidation

			
	},

	prepareCouponFacts: (userObj, cartObj, couponObj, miscData) => {

		// Any time a new rule is added, the new attribute and the way to fetch it must be defined here
		let couponFacts = {
			dateofApplication : couponUtil.getDateOfApplication(userObj, cartObj, couponObj, miscData),  
			usageCount : couponUtil.getUsageCount(userObj, cartObj, couponObj, miscData),  
			userPhone : couponUtil.getUserPhone(userObj, cartObj, couponObj, miscData)

		} 

		console.log(couponFacts)

		return couponFacts


	},

	getDateOfApplication: (userObj, cartObj, couponObj, miscData) => {
		const date = new Date();
		const timestamp = date.getTime();

		return timestamp
	},

	getUsageCount: (userObj, cartObj, couponObj, miscData) => {

		let usageCount : number = 0;

		if(!miscData.couponRedeemCount){
			usageCount = miscData.couponRedeemCount
		}

		return usageCount
	},

	getUserPhone: (userObj, cartObj, couponObj, miscData) => {
		let userPhone : string = ""

		if(!userObj.phone){
			userPhone = userObj.phone
		}

		return userPhone
	}



}


export default couponUtil;




































