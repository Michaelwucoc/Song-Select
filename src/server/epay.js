const crypto = require('crypto');
const axios = require('axios');

class EpayService {
  // 添加支付方式常量
  static PAYMENT_TYPES = {
    ALIPAY: 'alipay',
    WXPAY: 'wxpay'
  };

  constructor(merchantId, merchantKey, apiUrl) {
    this.merchantId = merchantId;
    this.merchantKey = merchantKey;
    this.apiUrl = apiUrl.replace(/\/+$/, ''); // 移除末尾斜杠
  }

  // MD5签名生成
  generateSign(params) {
    // 1. 过滤并排序参数
    const signParams = {};
    Object.keys(params)
      .filter(key => (
        key !== 'sign' && 
        key !== 'sign_type' && 
        params[key] !== undefined && 
        params[key] !== null && 
        params[key] !== ''
      ))
      .sort()
      .forEach(key => {
        signParams[key] = String(params[key]);
      });

    // 2. 拼接参数
    const signStr = Object.entries(signParams)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');

    // 3. 拼接商户密钥并MD5加密
    return crypto
      .createHash('md5')
      .update(signStr + this.merchantKey)
      .digest('hex')
      .toLowerCase();
  }

  // 创建支付表单
  createPaymentForm(params) {
    const formItems = Object.entries(params)
      .map(([key, value]) => `<input type="hidden" name="${key}" value="${value}"/>`)
      .join('\n');

    return `
      <form id="epayForm" method="POST" action="${this.apiUrl}/submit.php">
        ${formItems}
        <script>document.getElementById('epayForm').submit();</script>
      </form>
    `;
  }

  // 创建支付订单（页面跳转支付）
  // 创建支付订单
  // 修改创建支付订单方法
  createPaymentOrder(orderId, amount, name, payType, clientIp = '') {
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    
    // 验证支付方式
    if (!payType || !Object.values(EpayService.PAYMENT_TYPES).includes(payType)) {
      throw new Error('不支持的支付方式');
    }

    const params = {
      pid: String(this.merchantId),
      type: payType,  // 确保这里使用传入的 payType
      out_trade_no: String(orderId),
      notify_url: `${baseUrl}/api/epay/notify`,
      return_url: `${baseUrl}/songs`,
      name: String(name),
      money: amount.toFixed(2),
      sign_type: 'MD5',
      clientip: clientIp,
      device: 'pc'
    };

    params.sign = this.generateSign(params);
    return this.createPaymentForm(params);
  }
}

// 添加这行来导出类
module.exports = EpayService;