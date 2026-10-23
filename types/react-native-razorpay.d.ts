declare module 'react-native-razorpay' {
  export type RazorpayOptions = {
    key: string;
    amount: number | string;
    currency?: string;
    name?: string;
    description?: string;
    image?: string;
    order_id?: string;
    prefill?: {
      name?: string;
      email?: string;
      contact?: string;
    };
    notes?: Record<string, string>;
    theme?: {
      color?: string;
      hide_topbar?: boolean;
    };
    modal?: {
      backdropclose?: boolean;
      escape?: boolean;
      handleback?: boolean;
      confirm_close?: boolean;
      ondismiss?: () => void;
      animation?: boolean;
    };
    timeout?: number;
    readonly?: { email?: boolean; contact?: boolean; name?: boolean };
    hidden?: { email?: boolean; contact?: boolean };
  };

  export type PaymentSuccessData = {
    razorpay_payment_id: string;
    razorpay_order_id?: string;
    razorpay_signature?: string;
  };

  export type PaymentErrorData = {
    code: number;
    description: string;
    source: string;
    step: string;
    reason: string;
    metadata: {
      order_id?: string;
      payment_id?: string;
    };
  };

  class RazorpayCheckout {
    static open(options: RazorpayOptions): Promise<PaymentSuccessData>;
    static open(
      options: RazorpayOptions,
      successCallback: (data: PaymentSuccessData) => void,
      errorCallback: (data: PaymentErrorData) => void,
    ): void;
  }

  export default RazorpayCheckout;
}
