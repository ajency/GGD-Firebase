import { Application } from "express";
import Order from "./controllers/OrderController";
import Address from "./controllers/AddressController";
import User from "./controllers/UserController";
import misc from "./controllers/MiscController";
import { isAuthenticated } from "./auth/authenticated";

export function routesConfig(app: Application) {
	app.post('/rest/v1/anonymous/cart/insert',
		Order.addToCart
	);

	app.post('/rest/v1/anonymous/cart/delete',
		Order.removeFromCart
	);

	app.get('/rest/v1/anonymous/cart/fetch',
		Order.fetchCart
	);
	
	app.post('/rest/v1/user/cart/insert',
		isAuthenticated,
		Order.addToCart
	);

	app.post('/rest/v1/user/cart/delete',
		isAuthenticated,
		Order.removeFromCart
	);

	app.get('/rest/v1/user/cart/fetch',
		Order.fetchCart
	);

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

	app.post('/rest/v1/anonymous/cart/change-location',
		Order.updateDeliveryLocation
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

}