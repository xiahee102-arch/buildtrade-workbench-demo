'use strict';

const NAV = {
  acquire: [['market', '◎', '市场分析'], ['product', '▱', '产品分析'], ['design', '✧', '内容设计'], ['publish', '↗', '内容发布']],
  trade: [['customers', '▦', '客户管理'], ['chat', '◯', '聊天'], ['quotes', '▤', '报价系统'], ['orders', '◇', '订单系统']]
};
const META = {
  market: ['市场分析', '整理目标市场、客户画像与需要验证的机会。', '市场分析 Agent'],
  product: ['产品分析', '把已确认的产品事实，变成清晰的产品定位。', '产品分析 Agent'],
  design: ['内容设计', '围绕一个产品，完成一份可以交接的内容。', '设计 Agent'],
  publish: ['内容发布', '核对版本、批准内容，再登记人工发布。', '发布 Agent'],
  customers: ['客户管理', '管理客户资料、需求和下一次跟进。', '客户管理 Agent'],
  quotes: ['报价系统', '按规则计算金额，确认交期后批准报价。', '报价 Agent'],
  orders: ['订单系统', '从双方确认，到生产、发货与完成。', '订单 Agent']
};
const STORAGE_KEY = 'buildtrade-workspace-v5';
const freshState = () => ({
  schema: 5,
  market: {country: '马来西亚', buyer: '公寓项目承包商', focus: '304 不锈钢栏杆配套', report: '优先研究公寓与酒店项目的栏杆配套需求。通过规格选型内容吸引采购，记录目的港与数量；当前判断为待验证假设。', version: 1},
  products: [
    {id: 'HY-304-01', name: '304 不锈钢楼梯立柱', material: '304 不锈钢', spec: 'Ø50 × 900 mm · 壁厚 1.5 mm', finish: '拉丝', price: 6.4, positioning: '面向公寓、酒店项目的楼梯与阳台栏杆配套，服务项目承包商选型。', advantages: '标准化尺寸便于选型；拉丝外观适配现代项目；可与同系列配件配套。', version: 1},
    {id: 'HY-304-02', name: '304 不锈钢扶手管', material: '304 不锈钢', spec: 'Ø42 × 3000 mm', finish: '拉丝', price: 11.5, positioning: '适合楼梯和阳台栏杆项目中的扶手配套。', advantages: '标准管径便于搭配立柱与连接件。', version: 1},
    {id: 'HY-304-03', name: '不锈钢玻璃夹', material: '304 不锈钢', spec: '适配 8–12 mm 玻璃', finish: '拉丝', price: 1.85, positioning: '面向玻璃栏杆项目的固定配件选型。', advantages: '可与现有立柱系列配套，规格清晰。', version: 1}
  ],
  productId: 'HY-304-01',
  designProductId: 'HY-304-01',
  publicationHistory: [],
  draft: {title: '不锈钢立柱的项目选型指南', body: 'Stainless steel balustrade posts for your next apartment project. 304 stainless steel, Ø50 × 900 mm, brushed finish. Contact us with your required quantities and destination port for specifications and a quotation.', version: 1, productId: 'HY-304-01', productVersion: 1, approvedVersion: null, publication: null},
  customers: [
    {id: 'C-0187', name: 'KL Build Supply', person: 'Alex Tan', country: '马来西亚', type: '项目客户', tag: '高意向', port: 'Port Klang', followup: '2026-11-08T10:00', need: '立柱 800 · 扶手管 400 · 玻璃夹 1,600', note: '客户问及 SGS 报告，尚未提供证明。', version: 1},
    {id: 'C-0012', name: 'Syed Building Mart', person: 'Syed Hassan', country: '马来西亚', type: '经销商', tag: '合作客户', port: 'Port Klang', followup: '2026-11-10T10:00', need: '立柱与扶手管配套', note: '发货前跟进尾款。', version: 1},
    {id: 'C-0013', name: 'Ahmad Hardware', person: 'Ahmad', country: '马来西亚', type: '五金采购', tag: '待报价', port: '待确认', followup: '2026-11-07T15:00', need: '玻璃夹与连接件', note: '', version: 1},
    {id: 'C-0011', name: 'Johor Rail Fittings', person: 'Tan', country: '马来西亚', type: '项目客户', tag: '待了解', port: '待确认', followup: '2026-11-12T10:00', need: '样品与规格资料', note: '', version: 1}
  ],
  customerId: 'C-0187',
  quote: {id: 'Q-0187', customerId: 'C-0187', version: 1, quantities: [800, 400, 1600], delivery: 35, deliveryConfirmed: false, approvedVersion: null, buyerVersion: null},
  orders: [{id: 'SO-0012', customerId: 'C-0012', quoteVersion: 2, total: 15200, deposit: 4560, balanceRecorded: false, shipped: false, completed: false, bill: '', shipDate: '', note: '预计 12 月 5 日完成生产，12 月 8 日发货。'}],
  selectedOrder: 'SO-0012',
  chats: [
    {id: 'service', type: 'agent', name: '客服 Agent', subtitle: '整理客户需求，协调客户与报价 Agent', unread: 0, messages: [{who: 'agent', name: '客服 Agent', text: '我可以整理客户对话、同步需求或交接给其他 Agent。这里是内部对话；不会直接联系买家。', time: '10:20'}, {who: 'agent', name: '客服 Agent', text: 'KL Build Supply 的需求已整理：立柱 800 件、扶手管 400 件、玻璃夹 1,600 件，目的港 Port Klang。SGS 报告问题仍待人工确认。', time: '10:24'}]},
    {id: 'kl', type: 'person', name: 'Alex · KL Build Supply', subtitle: '单人会话 · 示例买家', unread: 1, messages: [{who: 'other', name: 'Alex Tan', text: 'Hi, we need stainless steel posts and glass clamps for an apartment project. Could you share the specifications?', time: '09:42'}, {who: 'self', name: '李总', text: 'Thank you, Alex. Could you confirm the quantities and destination port?', time: '09:45'}, {who: 'other', name: 'Alex Tan', text: '800 posts, 400 handrail tubes and 1600 clamps. Destination: Port Klang. Do you have an SGS test report?', time: '10:18'}]},
    {id: 'syed', type: 'person', name: 'Syed Hassan', subtitle: '单人会话 · 示例经销商', unread: 0, messages: [{who: 'other', name: 'Syed Hassan', text: 'Please let me know when the order is ready for shipment.', time: '昨天 16:20'}]},
    {id: 'project', type: 'group', name: '公寓项目 · 栏杆配套', subtitle: '群聊 · 4 位示例成员', unread: 2, messages: [{who: 'other', name: 'Alex Tan', text: 'We are confirming the handrail finish with our project designer.', time: '09:10'}, {who: 'other', name: '项目设计师', text: 'Brushed finish is preferred. Please share the dimensions.', time: '09:13'}, {who: 'agent', name: '客服 Agent', text: '已整理两条需求：拉丝表面、需要尺寸资料。可将需求同步到客户档案，尚未向外部发送回复。', time: '09:14'}]}
  ],
  chatId: 'service',
  messages: Object.fromEntries(Object.keys(META).map(key => [key, [{role: 'agent', text: ({market: '告诉我目标市场和产品，我可以整理研究假设，也能把确认的方向交给产品分析 Agent。', product: '我可以更新左侧产品定位和分析建议，或把已确认卖点交给设计 Agent。商品事实与认证修改需单独核实。', design: '我可以生成或修改当前英文内容；交接到发布时会固定内容版本。', publish: '当前草稿需要人工批准。修改内容会使旧审批失效；批准后仍需人工发布并登记链接。', customers: '我可以更新当前客户的标签、备注和跟进时间，也能向客服 Agent 获取需求摘要。', quotes: '金额由规则程序计算。我可以整理报价参数，正式报价需确认交期后批准。', orders: '我可以记录生产进度和跟进提醒；收款、发货和订单确认仍由你核实。'})[key]}]])),
  scopes: Object.fromEntries(Object.keys(META).map(k => [k, 'edit'])),
  files: [], audit: [], pending: {}, sequence: 100
});

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const validRows = (rows, check) => Array.isArray(rows) && rows.length > 0 && rows.every(check);
    const versioned = x => x && typeof x.id === 'string' && Number.isInteger(x.version) && x.version > 0;
    if (parsed?.schema === 5 && validRows(parsed.customers, versioned) &&
        validRows(parsed.products, p => versioned(p) && typeof p.name === 'string' && Number.isFinite(p.price) && p.price >= 0) &&
        validRows(parsed.orders, o => o && typeof o.id === 'string' && Number.isFinite(o.total)) &&
        validRows(parsed.chats, c => c && typeof c.id === 'string' && typeof c.name === 'string' && Array.isArray(c.messages)) &&
        parsed.quote && Number.isInteger(parsed.quote.version) && Array.isArray(parsed.quote.quantities) &&
        parsed.quote.quantities.length === parsed.products.length && parsed.quote.quantities.every(q => Number.isInteger(q) && q > 0 && q <= 1000000) &&
        parsed.draft && typeof parsed.draft.body === 'string' && Number.isInteger(parsed.draft.version) &&
        parsed.market && typeof parsed.market.report === 'string' && Number.isInteger(parsed.market.version) &&
        parsed.messages && typeof parsed.messages === 'object' && parsed.scopes && typeof parsed.scopes === 'object' &&
        Array.isArray(parsed.audit) && Array.isArray(parsed.files) && parsed.pending && Number.isInteger(parsed.sequence)) {
      for (const page of Object.keys(META)) {
        if (!Array.isArray(parsed.messages[page])) parsed.messages[page] = [];
        if (!['edit', 'suggest'].includes(parsed.scopes[page])) parsed.scopes[page] = 'suggest';
      }
      parsed.designProductId ||= parsed.draft.productId;
      parsed.publicationHistory = Array.isArray(parsed.publicationHistory) ? parsed.publicationHistory : [];
      if (parsed.draft.publication && !parsed.publicationHistory.some(x => x.version === parsed.draft.publication.version)) parsed.publicationHistory.push(parsed.draft.publication);
      return parsed;
    }
  } catch {}
  return freshState();
}
