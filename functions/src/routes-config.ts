import { Application } from "express";
import Cart from "./controllers/CartController";
import Address from "./controllers/AddressController";
import { isAuthenticated } from "./auth/authenticated";

export function routesConfig(app: Application) {
	app.post('/add-to-cart',
		isAuthenticated,
		Cart.checkAvailability
	);

	app.post('/add-address',
		isAuthenticated,
		Address.addAddress
	);

	app.get('/get-addresses',
		isAuthenticated,
		Address.getAddresses
	);
}