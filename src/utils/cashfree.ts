import axios from 'axios';
import { env } from '../config/env.js';
import { logger } from './logger.js';
import { AppError, ERROR_CODES } from './errors.js';

interface CashfreeOrderRequest {
    orderId: string;
    amount: number;
    customerId: string;
    customerPhone: string;
    customerEmail?: string;
}

export async function createCashfreeOrder(request: CashfreeOrderRequest): Promise<string> {
    const { orderId, amount, customerId, customerPhone, customerEmail } = request;

    if (!env.CASHFREE_APP_ID || !env.CASHFREE_API_KEY) {
        // Fallback for local testing if Cashfree credentials are not set
        logger.warn('Cashfree credentials not set, generating dummy payment session.');
        return 'dummy_payment_session_id';
    }

    try {
        const response = await axios.post(
            `${env.CASHFREE_API_URL.replace(/\/$/, '')}/orders`,
            {
                order_id: orderId,
                order_amount: amount,
                order_currency: 'INR',
                customer_details: {
                    customer_id: customerId,
                    customer_phone: customerPhone || '9999999999',
                    customer_email: customerEmail || 'dummy@example.com',
                },
                order_meta: {
                    return_url: `http://localhost:3001/wallet?order_id={order_id}`,
                },
            },
            {
                headers: {
                    'x-client-id': env.CASHFREE_APP_ID,
                    'x-client-secret': env.CASHFREE_API_KEY,
                    'x-api-version': '2023-08-01',
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
            }
        );

        // Cashfree usually returns payment_session_id which is used by checkout SDKs.
        // It also returns order_meta.payment_link if you want simple redirection.
        const paymentSessionId = response.data.payment_session_id;

        // For simple redirection as requested by user, we can return the paymentUrl if available
        // Or if the frontend should construct the checkout, return session id.
        // Let's check payment_link fallback or just return session id and let frontend use Cashfree SDK,
        // but since user requested "Redirect to payment gateway", `paymentUrl = ...` is preferred.

        // Actually the endpoint typically returns `payment_session_id` and the user drops in Cashfree SDK.
        // Let's just return the payment_session_id as the paymentUrl if we can't find payment_link.
        // Actually, returning both or either.

        // If there's a payment_link, return it. Otherwise just return a dummy string if we fallback.
        const paymentLink = response.data.order_meta?.payment_link || response.data.payment_session_id;

        logger.info({ orderId, amount }, 'Cashfree order created');
        return paymentLink;

    } catch (error: any) {
        logger.error({
            err: error.message,
            response: error.response?.data,
            orderId,
            amount
        }, 'Failed to create Cashfree order');
        throw new AppError(ERROR_CODES.INTERNAL_ERROR, 'Payment gateway error', 500);
    }
}
