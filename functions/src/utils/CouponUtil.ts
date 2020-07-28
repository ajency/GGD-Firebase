// import couponRules from '../utils/couponRules';
const { Engine } = require("json-rules-engine")
const { _ } = require("underscore")


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
		      userObj : userObj,
		      cartObj : cartObj,
		      couponObj: couponObj,
		      miscData: miscData

		    }
	  	};

		let conditions = couponObj.rules;
		let rule = { conditions, event, priority:10, name:'applyCouponRules'};
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
		    	resolve(couponUtil.processRuleResult(true, ruleResult, event ));
			});

			couponRuleEngine.on('failure', function (event, almanac, ruleResult) {
		    	reject(couponUtil.processRuleResult(true, ruleResult, event ));
			});

	    })
	},

	
	processRuleResult: (success=false, ruleResult, event) => {

		let processedRuleResult: any = {};
		let allFailedConditions: any = [];
		let anyFailedConditions: any = [];
		let failedConditionFacts: any = [];
		let failedRuleList: any = [];
		let message:String = "";

		switch (success) {
			case true:	

				processedRuleResult["success"] = true,
				processedRuleResult["code"] = event.params.couponObj.success.code,
				processedRuleResult["message"] = event.params.couponObj.success.message,
				processedRuleResult["formatted_message"] = event.params.couponObj.success.formatted_message
				console.log(`Inside RULE ENGINE SUCCESS\n ruleResult = ${JSON.stringify(processedRuleResult)}`)
				return processedRuleResult

				break;

			case false:

				if(ruleResult.conditions.all){
					allFailedConditions = _.where(ruleResult.conditions.all, {result: false});
				}
				if(ruleResult.conditions.any){
					anyFailedConditions = _.where(ruleResult.conditions.any, {result: false});
				}

				failedConditionFacts = _.pluck(allFailedConditions.concat(anyFailedConditions), 'fact')
				console.log(`Inside RULE ENGINE FAILURE\n ruleResult = ${JSON.stringify(failedConditionFacts)}`)


				failedRuleList = _.filter(event.params.couponObj.rules.all, function(ruleObj){ 
						return failedConditionFacts.includes(ruleObj.fact); 
					});
				
				processedRuleResult["success"] = false,
				processedRuleResult["code"] = failedRuleList[0]['fact'],
				processedRuleResult["message"] = failedRuleList[0]['error']['message'],
				processedRuleResult["formatted_message"] = failedRuleList[0]['error']['formatted_message']

				return processedRuleResult			

				break;

		}

		
		

	},

	prepareCouponFacts: (userObj, cartObj, couponObj, miscData) => {

		// Any time a new rule is added, the new attribute/fact and the way to fetch it must be defined here
		let couponFacts = {
			VALID_FROM : couponUtil.getDateOfApplication(userObj, cartObj, couponObj, miscData),  
			VALID_TO : couponUtil.getDateOfApplication(userObj, cartObj, couponObj, miscData),  
			USAGE_LIMIT : couponUtil.getUsageCount(userObj, cartObj, couponObj, miscData),  
			EXCLUDE_USER_PHONES : couponUtil.getUserPhone(userObj, cartObj, couponObj, miscData),
			INCLUDE_USER_PHONES : couponUtil.getUserPhone(userObj, cartObj, couponObj, miscData)

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

		if(miscData.couponRedeemCount){
			usageCount = miscData.couponRedeemCount
		}

		return usageCount
	},

	getUserPhone: (userObj, cartObj, couponObj, miscData) => {
		let userPhone : string = ""
		if(userObj.phone){
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




































