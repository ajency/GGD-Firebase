import couponRules from '../utils/couponRules';

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

	validateCoupon: async (userObj, cartObj, couponObj) => {


		/**
		 * Define facts the engine will use to evaluate the conditions above.
		 * Facts may also be loaded asynchronously at runtime; see the advanced example below
		 */
		let facts = {
		  personalFoulCount: 6,
		  gameDuration: 40
		}

		// Run the engine to evaluate
		let ruleValidation =  await couponRules.run(facts)
		return ruleValidation

			
	}




}


export default couponUtil;




































