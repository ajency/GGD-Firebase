import { Application } from "express";
import { addToCart} from "./controllers/CartController";

export function routesConfig(app: Application) {
	app.post('/add-to-cart',
		addToCart
	);
}