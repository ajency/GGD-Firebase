import { Application } from "express";
import Order from "./controllers/OrderController";
import Address from "./controllers/AddressController";
import User from "./controllers/UserController";
import misc from "./controllers/MiscController";
import Products from "./controllers/ProductController";

import { isAuthenticated } from "./auth/authenticated";
import Payment from './controllers/PaymentController';
import Admin from "./controllers/AdminController";

export function routesConfig(app: Application) {
	app.post('/rest/v1/user/add-address',
		isAuthenticated,
		Address.addAddress
	);

	app.get('/rest/v1/user/get-addresses',
		isAuthenticated,
		Address.getAddresses
	);

	app.get('/rest/v1/places-autocomplete',
		misc.placesAutoComplete
	);

	app.get('/rest/v1/reverse-geocode',
		misc.reverseGeoCode
	);

	app.get('/rest/v1/check-user-exist',
		User.userExists
	);

	app.post('/rest/v1/user/update-user-details',
		isAuthenticated,
		User.updateUserDetails
	);

	app.post('/rest/v1/user/map-orders-addresses',
		isAuthenticated,
		User.mapOrdersAddresses
	);

	app.get('/rest/v1/misc/fetch-variants',
		Products.getVariants
	);

	app.get('/rest/v1/store-fcm-token',
		misc.storeFcmToken
	);

	app.post('/rest/v1/anonymous/payment/create-order', 
		Payment.createOrder
	);
	app.post('/rest/v1/payment/confirm-order', 
		Order.confirmOrder
	);
	
	app.post('/rest/v1/anonymous/payment/verify-payment',
		Payment.verifySignature
	);

	app.post('/rest/v1/order/update-status', 
		Order.updateOrderStatus
	);
	app.get('/rest/v1/order/migrate-user', 
		User.migrateUser
	);

	app.get('/rest/v1/admin/download-product-csv', 
		Admin.getProductsCSV
	);

	app.get('/rest/v1/admin/update-products-status', 
		Admin.fetchDataFromAirtable
	);

	app.get('/rest/v1/admin/update-cart-with-user-id',
		Admin.updateCartsWithUserId
	);

	app.get('/rest/v1/admin/create-orders',
		Admin.createOrders
	);

	app.get('/rest/v1/admin/get-all-products',
		Products.fetchProducts
	)
}