// import couponRules from '../utils/couponRules';
const { Engine } = require("json-rules-engine")


let couponUtil = {

	validateCoupon: async (userObj, cartObj, couponObj, miscData) => {

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
		      error: {
		      	code : 'EXPIRY_INVALID',
		      	message: "Validity of coupon has expired",
		      	formatted_message: "<div class='msg-error'><p>Please enter valid coupon code.</p></div>"
		      },
		      success: {
		      	code : 'EXPIRY_VALID',
		      	message: "Validity of coupon has expired",
		      	formatted_message: "<div class='msg-success'><p>Yay! coupon code applied successfully, You have availed discount of <span>₹ 100</span></p></div>"
		      },
		      couponObj: couponObj 
		    }
	  	};

		let conditions = {

			all: [
				{
					fact: 'dateofApplication',
					operator: 'greaterThanInclusive',
					value: new Date("2016-07-27T07:45:00Z").getTime() // "YYYY-MM-DDTHH:MM:SSZ" - ISO format and assumed UTC if timezone not passed
				}, 
				{
					fact: 'dateofApplication',
					operator: 'lessThanInclusive',
					value: new Date("2020-07-31T07:45:00Z").getTime()
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
		};

		let rule = { conditions, event, priority:10, name:'applyCouponRule'};
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
	    return new Promise(function(resolve, reject) {

			/**
		 	* Handling Events
			*/

	        // Do async job
	        // subscribe to any event emitted by the engine
			couponRuleEngine.on('success', function (event, almanac, ruleResult) {
		    	console.log(`Inside RULE ENGINE SUCCESS\n ruleResult = ${JSON.stringify(ruleResult)}`)
		    	resolve({event, almanac, ruleResult});
			});

			couponRuleEngine.on('failure', function (event, almanac, ruleResult) {
		    	console.log(`Inside RULE ENGINE FAILURE\n ruleResult = ${JSON.stringify(ruleResult)}`)
		    	reject({event, almanac, ruleResult});
			});

	    })
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
	},

	successRuleApplied: (event, engine) => {
		console.log('Success event:\n', event);
	},

	failureRuleApplied: (event, engine) => {
	    console.log('Failure event:\n', event);
	}



}


export default couponUtil;




































