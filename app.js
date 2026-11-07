'use strict';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const h = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const tag = (text, type = '') => `<span class="tag ${type}">${text}</span>`;
const money = n => Number(n).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const validPage = p => p === 'home' || p === 'chat' || Object.hasOwn(META, p);
let state = loadState();
let ui = {page: validPage(location.hash.slice(1)) ? location.hash.slice(1) : 'home', homeSpace: 'acquire', customerSearch: '', chatSearch: '', chatFilter: 'all', chatRoomOpen: false, agentOpen: false};
let toastTimer, modalHandler, storageFailed = false;
const currentProduct = () => state.products.find(p => p.id === state.productId) || state.products[0];
const currentCustomer = () => state.customers.find(c => c.id === state.customerId) || state.customers[0];
const currentOrder = () => state.orders.find(o => o.id === state.selectedOrder) || state.orders[0];
const quoteTotal = () => Math.round(state.products.reduce((sum, p, i) => sum + p.price * state.quote.quantities[i], 0) * 100) / 100;
const space = () => ui.page === 'home' ? ui.homeSpace : NAV.trade.some(n => n[0] === ui.page) ? 'trade' : 'acquire';
const timeNow = () => new Intl.DateTimeFormat('zh-CN', {timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit'}).format(new Date());
function formatDate(value) { return value ? h(value.replace('T', ' ').replace(/^2026-/, '')) : '未安排'; }

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); storageFailed = false; }
  catch { if (!storageFailed) toast('浏览器存储不可用，当前修改仅保留在本次会话。'); storageFailed = true; }
}
function toast(text) {
  $('#toast').textContent = text;
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4500);
}
function audit(action, detail, change = null) {
  state.audit.unshift({id: ++state.sequence, action, detail, time: timeNow(), change, undone: false});
  state.audit = state.audit.slice(0, 150);
}
function message(page, role, text) {
  state.messages[page] ||= [];
  state.messages[page].push({role, text});
  state.messages[page] = state.messages[page].slice(-65);
}
function render() {
  const view = {market: marketView, product: productView, design: designView, publish: publishView, customers: customersView, quotes: quotesView, orders: ordersView};
  const body = ui.page === 'home' ? homeView() : ui.page === 'chat' ? chatView() : `<div class="workspace">${sidebar()}<main class="work">${view[ui.page]()}<div class="work-note">本地演示 · 可保存前端数据；非真实模型、市场研究或业务记录。</div></main>${agentView()}</div><div class="mobile-scrim ${ui.agentOpen ? 'show' : ''}" data-action="close-agent"></div><button class="mobile-agent-toggle" data-action="open-agent">✧ ${META[ui.page][2]}</button>`;
  $('#app').innerHTML = header() + body;
  document.title = (ui.page === 'home' ? '获客与交易' : ui.page === 'chat' ? '聊天' : META[ui.page][0]) + ' · 外贸助手';
  const agent = $('#agent-messages');
  if (agent) agent.scrollTop = agent.scrollHeight;
  const chat = $('#chat-content');
  if (chat) chat.scrollTop = chat.scrollHeight;
}
function route(page) {
  if (!validPage(page)) page = 'home';
  ui.page = page;
  ui.agentOpen = false;
  ui.chatRoomOpen = false;
  if (page !== 'home') ui.homeSpace = space();
  location.hash = page;
  render();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', () => {
  const target = location.hash.slice(1);
  if (target !== ui.page) route(validPage(target) ? target : 'home');
});

function openModal(title, description, fields, handler, label = '保存') {
  modalHandler = handler;
  $('#dialog-body').innerHTML = `<div class="dialog-head"><h2>${h(title)}</h2><p>${h(description)}</p></div><form id="modal-form" class="dialog-body">${fields}<div class="dialog-actions"><button type="button" data-action="close-dialog">取消</button><button class="primary" type="submit">${h(label)}</button></div></form>`;
  $('#dialog').showModal();
  $('#dialog').querySelector('input,textarea,select,button')?.focus();
}
function field(label, name, value = '', type = 'text', extra = '') {
  return `<label class="field">${h(label)}<input name="${name}" type="${type}" value="${h(value)}" ${extra}></label>`;
}
function textarea(label, name, value = '', extra = '') {
  return `<label class="field">${h(label)}<textarea name="${name}" ${extra}>${h(value)}</textarea></label>`;
}
function commit() { save(); render(); }
function invalidateDraft(productId) {
  if (state.draft.productId === productId) state.draft.approvedVersion = null;
}
function updateDraft(title, body) {
  const p = state.products.find(x => x.id === state.draft.productId) || currentProduct();
  const before = structuredClone(state.draft);
  state.draft = {...state.draft, title, body, version: state.draft.version + 1, productVersion: p.version, approvedVersion: null};
  audit('更新内容版本', `内容 v${state.draft.version}；旧发布审批失效`, {kind: 'draft', before, expectedVersion: state.draft.version});
}
function reviseQuote() {
  state.quote.version++;
  state.quote.deliveryConfirmed = false;
  state.quote.approvedVersion = null;
  state.quote.buyerVersion = null;
  audit('报价版本更新', `报价 v${state.quote.version}，重置交期、老板批准与买家确认`);
}
function recordCustomer(c, patch, actor = '人工') {
  const before = structuredClone(c);
  Object.assign(c, patch, {version: c.version + 1});
  audit(actor + '修改客户', `${c.name} / v${c.version} / ${Object.keys(patch).join('、')}`, {kind: 'customer', id: c.id, before, expectedVersion: c.version});
}
function draftBody(p) {
  return `${p.name.includes('玻璃夹') ? 'Stainless steel glass clamps' : p.name.includes('扶手管') ? 'Stainless steel handrail tubes' : 'Stainless steel balustrade posts'} for apartment projects. ${p.material === '304 不锈钢' ? '304 stainless steel.' : 'Please contact us for the confirmed material specifications.'} ${p.finish === '拉丝' ? 'Brushed finish.' : 'Contact us for the confirmed surface finish.'} Contact us with your required quantities and destination port for specifications and a quotation.`;
}

// Every simulated Agent mutation is scoped, version-checked and recorded.
function propose(page, op, summary) {
  if (state.scopes[page] === 'suggest') {
    state.pending[page] = {...op, summary};
    message(page, 'system', '仅建议模式：已生成待确认修改，尚未写入左侧面板。');
  } else applyOperation(page, op);
}
function applyOperation(page, op) {
  if (op.kind === 'product-position') {
    const p = state.products.find(x => x.id === op.id);
    if (!p || p.version !== op.version) throw Error('产品版本已变化，请重新提出修改。');
    const before = structuredClone(p);
    p.positioning = op.text; p.version++;
    invalidateDraft(p.id);
    audit('Agent 修改产品定位', `${p.id} / v${p.version}；未改商品事实`, {kind: 'product', id: p.id, before, expectedVersion: p.version});
    message(page, 'receipt', `已更新左侧「目标应用与定位」。\n${p.positioning}\n分析 v${p.version}，商品材质与认证保持原值。`);
  } else if (op.kind === 'customer') {
    const c = state.customers.find(x => x.id === op.id);
    if (!c || c.version !== op.version) throw Error('客户资料版本已变化，请重新提出修改。');
    recordCustomer(c, op.patch, 'Agent');
    message(page, 'receipt', `已修改 ${c.name} 的 ${Object.keys(op.patch).map(k => ({tag: '意向标签', followup: '跟进时间', note: '备注', need: '需求摘要', port: '目的港'}[k])).join('、')}。\n客户版本 v${c.version}；可在操作记录中撤销。`);
  } else if (op.kind === 'draft') {
    if (state.draft.version !== op.version) throw Error('内容版本已变化，请重新生成。');
    updateDraft(op.title, op.body);
    message(page, 'receipt', `已生成英文内容 v${state.draft.version} 并更新左侧编辑器。\n演示稿不含价格、交期和认证承诺，需人工复核。`);
  } else if (op.kind === 'market') {
    if (state.market.version !== op.version) throw Error('市场分析已变化，请重新生成。');
    state.market.report = op.report; state.market.version++;
    audit('Agent 整理市场框架', `市场分析 v${state.market.version}；未联网研究`);
    message(page, 'receipt', '已整理左侧验证框架，结果仍标为假设；没有获取实时市场数据。');
  } else if (op.kind === 'production') {
    const o = state.orders.find(x => x.id === op.id);
    if (!o || o.note !== op.before || o.completed) throw Error('订单状态已变化，请重新确认。');
    o.note = op.text;
    audit('Agent 更新生产备注', `${o.id} / ${op.text}`);
    message(page, 'receipt', `已更新订单 ${o.id} 的生产备注。未修改收款、发货或完成状态。`);
  } else throw Error('此操作不在允许范围内。');
}

function handoff(from, to, text) {
  message(from, 'relay', `${META[from][2]} → ${META[to][2]}\n${text}\n对方已收到本地交接记录。`);
  message(to, 'relay', `${META[from][2]} → ${META[to][2]}\n${text}`);
  audit('Agent 间交接', `${META[from][2]} → ${META[to][2]}`);
}
function productHandoff() {
  const p = currentProduct();
  state.draft.productId = p.id;
  state.draft.approvedVersion = null;
  handoff('product', 'design', `产品 ${p.id} / 分析 v${p.version}\n定位：${p.positioning}\n卖点：${p.advantages}\n只交接资料，不自动覆盖已有内容。`);
}
function serviceSummary() {
  // The seed conversation is explicitly tied to C-0187; it never overwrites another customer.
  const c = state.customers.find(x => x.id === 'C-0187');
  if (!c) throw Error('未找到与示例会话关联的客户。');
  const text = '立柱 800 · 扶手管 400 · 玻璃夹 1,600';
  propose('customers', {kind: 'customer', id: c.id, version: c.version, patch: {need: text, port: 'Port Klang'}}, '将关联客服摘要写入 KL Build Supply 的需求与目的港。');
  const awaiting = state.scopes.customers === 'suggest';
  message('customers', 'relay', '客服 Agent → 客户管理 Agent\n已收到 KL Build Supply 的示例对话摘要：' + text + '；目的港 Port Klang。\n' + (awaiting ? '当前为仅建议模式，尚未写入，等待确认。' : '已按授权写入客户档案。') + '\nSGS 报告问题保留为待人工确认，未添加认证承诺。');
  const service = state.chats.find(x => x.id === 'service');
  service.messages.push({who: 'agent', name: '客服 Agent', text: '已向客户管理 Agent 发送 KL Build Supply 的结构化需求摘要。' + (awaiting ? '等待你确认后写入档案。' : '客户档案已更新。') + '没有对外发送消息。', time: timeNow()});
  audit('客服 Agent 同步需求', '客户 C-0187 / 来源：预置示例会话；未调用模型');
}

function runAgent(page, text) {
  message(page, 'user', text);
  if (/认证|证书|最低价|取消审批|自动签|自动报价/.test(text)) {
    message(page, 'agent', '该请求涉及认证、价格或业务承诺，需要人工核实。演示 Agent 不能跳过审批，也不能自行补造商品事实。');
    return;
  }
  if (page === 'product' && /设计|交接/.test(text)) productHandoff();
  else if (page === 'product' && /定位/.test(text)) {
    const p = currentProduct();
    const target = text.split(/改为|改成|修改为/)[1]?.trim().slice(0, 500) || '面向马来西亚公寓项目承包商，突出标准规格、配套选型与安装场景。';
    propose(page, {kind: 'product-position', id: p.id, version: p.version, text: target}, `修改 ${p.name} 的定位：${target}`);
  } else if (page === 'market' && /产品|交接/.test(text)) {
    handoff('market', 'product', `目标市场：${state.market.country}\n客户：${state.market.buyer}\n产品方向：${state.market.focus}\n研究判断为待验证假设，未写入商品事实。`);
  } else if (page === 'market' && /整理|分析|研究/.test(text)) {
    const m = state.market;
    const report = `市场：${m.country}；目标客户：${m.buyer}；产品：${m.focus}。\n\n验证步骤：\n1. 收集已授权来源和买家实际询问，确认项目与规格需求。\n2. 使用清晰的规格与安装内容测试询盘意向。\n3. 记录有效询盘、目的港与数量，观察后再调整方向。\n\n这是演示研究框架，未检索实时市场信息。`;
    propose(page, {kind: 'market', version: m.version, report}, '替换当前市场分析为结构化验证框架。');
  } else if (page === 'design' && /发布|交接/.test(text)) {
    handoff('design', 'publish', `内容 v${state.draft.version}：${state.draft.title}\n提交人工发布审批，不执行自动发布。`);
  } else if (page === 'design' && /生成|改写|英文/.test(text)) {
    const p = state.products.find(x => x.id === state.draft.productId) || currentProduct();
    propose(page, {kind: 'draft', version: state.draft.version, title: p.name + ' · 项目选型介绍', body: draftBody(p)}, '根据已确认产品资料生成英文演示稿，并建立新版本。');
  } else if (page === 'customers' && /客服|摘要/.test(text)) {
    if (currentCustomer().id !== 'C-0187') message(page, 'agent', '当前客户暂无关联的示例客服摘要。请选择 KL Build Supply 后使用此演示。');
    else serviceSummary();
  } else if (page === 'customers' && /高意向/.test(text)) {
    const c = currentCustomer();
    propose(page, {kind: 'customer', id: c.id, version: c.version, patch: {tag: '高意向'}}, `将 ${c.name} 标记为高意向。`);
  } else if (page === 'customers' && /跟进/.test(text)) {
    const c = currentCustomer(), followup = /15|下午/.test(text) ? '2026-11-08T15:00' : '2026-11-08T10:00';
    propose(page, {kind: 'customer', id: c.id, version: c.version, patch: {followup}}, `修改 ${c.name} 的演示跟进时间为 ${followup.replace('T', ' ')}；不会创建系统提醒。`);
  } else if (page === 'customers' && /备注[：:]/.test(text)) {
    const c = currentCustomer(), note = text.split(/备注[：:]/).slice(1).join('：').trim().slice(0, 500);
    propose(page, {kind: 'customer', id: c.id, version: c.version, patch: {note}}, '修改当前客户备注。');
  } else if (page === 'orders' && /生产进度[：:]/.test(text)) {
    const o = currentOrder(), content = text.split(/生产进度[：:]/)[1]?.trim().slice(0, 200);
    if (!content) message(page, 'agent', '请用“记录生产进度：…”描述要记录的内容。');
    else propose(page, {kind: 'production', id: o.id, before: o.note, text: content}, `将订单 ${o.id} 的生产备注修改为：${content}`);
  } else if (page === 'quotes') {
    message(page, 'agent', `当前报价 v${state.quote.version}，程序总额 US$${money(quoteTotal())}；建议交期 ${state.quote.delivery} 天。\n${state.quote.deliveryConfirmed ? '交期已由人确认。' : '交期尚未由人确认。'}数量可在左侧修改，正式报价需要逐版批准。`);
  } else if (page === 'publish') {
    const p = state.products.find(x => x.id === state.draft.productId);
    message(page, 'agent', `当前内容 v${state.draft.version}。${state.draft.approvedVersion === state.draft.version ? '本版已获人工批准。' : '等待人工批准。'}\n${state.draft.productVersion === p?.version ? '引用产品分析版本一致。' : '商品或分析版本变化，请回内容设计保存新版本并复核。'}\n演示不会自动检查任意文案的事实，也不会连接社交平台。`);
  } else message(page, 'agent', '这是受控前端演示，尚未连接真实模型。请使用下方示例指令，或直接在左侧编辑表单；自由指令不会被伪装成已执行。');
}

function undoChange(id) {
  const entry = state.audit.find(x => x.id === id), change = entry?.change;
  if (!change || entry.undone) throw Error('该记录不可撤销或已撤销。');
  if (change.kind === 'customer' || change.kind === 'product') {
    const list = change.kind === 'customer' ? state.customers : state.products;
    const entity = list.find(x => x.id === change.id);
    if (entity?.version !== change.expectedVersion) throw Error('此记录之后已有新修改，不能覆盖后续版本。');
    Object.assign(entity, change.before, {version: entity.version + 1});
    if (change.kind === 'product') invalidateDraft(entity.id);
  } else if (change.kind === 'draft') {
    if (state.draft.version !== change.expectedVersion) throw Error('内容已有后续版本，不能直接撤销。');
    const version = state.draft.version + 1;
    state.draft = {...change.before, version, approvedVersion: null};
  }
  entry.undone = true;
  audit('撤销修改', entry.action + '；创建恢复版本，原记录保留');
}

function action(name) {
  const q = state.quote;
  if (name === 'open-agent' || name === 'close-agent') { ui.agentOpen = name === 'open-agent'; render(); return; }
  if (name === 'close-dialog') { $('#dialog').close(); return; }
  if (name === 'upload') { $('#agent-file')?.click(); return; }
  if (name === 'market-handoff') { runAgent('market', '交给产品分析 Agent'); commit(); toast('已记录交接，可前往产品分析查看。'); return; }
  if (name === 'product-handoff') { productHandoff(); commit(); toast('已交给设计 Agent，现有内容未自动覆盖。'); return; }
  if (name === 'design-handoff') { handoff('design', 'publish', `内容 v${state.draft.version} / ${state.draft.title}；等待人工批准。`); commit(); route('publish'); return; }
  if (name === 'edit-facts') {
    const p = currentProduct(), baseVersion = p.version;
    openModal('人工确认产品事实', '只有人工确认的规格才可进入对外内容，修改将使原发布审批失效。', field('材质', 'material', p.material, 'text', 'required maxlength="80"') + field('规格', 'spec', p.spec, 'text', 'required maxlength="150"') + field('表面处理', 'finish', p.finish, 'text', 'required maxlength="80"'), f => {
      if (p.version !== baseVersion) throw Error('产品已变化，请重新打开编辑。');
      const before = structuredClone(p);
      Object.assign(p, {material: f.get('material').trim(), spec: f.get('spec').trim(), finish: f.get('finish').trim(), version: p.version + 1});
      invalidateDraft(p.id); audit('人工修改商品事实', `${p.id} / v${p.version}`, {kind: 'product', id: p.id, before, expectedVersion: p.version});
    }); return;
  }
  if (name === 'publish-approve') {
    const d = state.draft, p = state.products.find(x => x.id === d.productId);
    if (d.productVersion !== p?.version) throw Error('引用的产品版本已变化，请回内容设计保存并复核。');
    d.approvedVersion = d.version; audit('人工批准内容', `内容 v${d.version}；未自动发布`); message('publish', 'receipt', `内容 v${d.version} 已由人批准。请在企业主页人工发布后登记链接。`); commit(); return;
  }
  if (name === 'copy-draft') {
    navigator.clipboard?.writeText(state.draft.body).then(() => toast('文案已复制。')).catch(() => toast('复制权限不可用，请手动选择文案。')); return;
  }
  if (name === 'add-customer' || name === 'edit-customer') {
    const edit = name === 'edit-customer', c = edit ? currentCustomer() : {name: '', person: '', country: '马来西亚', port: '', type: '项目客户', tag: '待了解', followup: '', need: '', note: ''};
    const baseVersion = c.version;
    openModal(edit ? '编辑客户资料' : '新增客户', '示例资料仅保存在当前浏览器，不会联系客户。', field('公司名', 'name', c.name, 'text', 'required maxlength="100"') + field('联系人', 'person', c.person, 'text', 'required maxlength="80"') + field('国家 / 地区', 'country', c.country, 'text', 'required maxlength="80"') + field('目的港', 'port', c.port, 'text', 'maxlength="100"') + field('意向标签', 'tag', c.tag, 'text', 'required maxlength="30"') + field('下次跟进', 'followup', c.followup, 'datetime-local') + textarea('需求', 'need', c.need, 'maxlength="1000"') + textarea('备注', 'note', c.note, 'maxlength="1000"'), f => {
      const patch = Object.fromEntries(['name', 'person', 'country', 'port', 'tag', 'followup', 'need', 'note'].map(key => [key, f.get(key).trim()]));
      if (edit) { if (c.version !== baseVersion) throw Error('客户资料已变化，请重新编辑。'); recordCustomer(c, patch); }
      else { const customer = {...patch, id: 'C-' + (++state.sequence), type: '项目客户', version: 1}; state.customers.push(customer); state.customerId = customer.id; audit('新增示例客户', customer.name); }
    }); return;
  }
  if (name === 'customer-summary') {
    if (currentCustomer().id !== 'C-0187') throw Error('当前只有 KL Build Supply 有关联的示例对话，不能把其他客户的需求写入此客户。');
    serviceSummary(); commit(); toast('已同步客服摘要，客户记录可查看。'); return;
  }
  if (name === 'customer-chat') {
    const ids = {'C-0187': 'kl', 'C-0012': 'syed'}, c = currentCustomer();
    state.chatId = ids[c.id] || 'local-' + c.id;
    if (!state.chats.some(x => x.id === state.chatId)) state.chats.push({id: state.chatId, type: 'person', name: c.person + ' · ' + c.name, subtitle: '单人会话 · 本地模拟', unread: 0, messages: []});
    save(); route('chat'); ui.chatRoomOpen = true; render(); return;
  }
  if (name === 'confirm-delivery') { q.deliveryConfirmed = true; audit('人工确认交期', `${q.id} / v${q.version} / ${q.delivery} 天`); commit(); return; }
  if (name === 'approve-quote') {
    if (!q.deliveryConfirmed) throw Error('请先确认交期。');
    q.approvedVersion = q.version; audit('人工批准报价', `v${q.version} / US$${money(quoteTotal())} / ${q.delivery} 天`); message('quotes', 'receipt', `报价 v${q.version} 已批准，发送稿已在左侧生成，未执行对外发送。`); commit(); return;
  }
  if (name === 'buyer-confirm') {
    if (q.approvedVersion !== q.version) throw Error('当前报价版本未批准。');
    q.buyerVersion = q.version; audit('模拟记录买家确认', `报价 v${q.version}，不代表真实买家操作`); commit(); return;
  }
  if (name === 'create-order') {
    if (q.buyerVersion !== q.version || q.approvedVersion !== q.version) throw Error('买家与老板须确认同一报价版本。');
    const key = q.id + '-v' + q.version;
    const prior = state.orders.find(o => o.source === key);
    if (prior) { state.selectedOrder = prior.id; save(); route('orders'); toast('该版本已建立订单，未重复创建。'); return; }
    const order = {id: 'SO-' + (++state.sequence), source: key, customerId: q.customerId, quoteVersion: q.version, total: quoteTotal(), deposit: 0, balanceRecorded: false, shipped: false, completed: false, bill: '', shipDate: '', note: '双方已模拟确认，等待生产安排。'};
    state.orders.push(order); state.selectedOrder = order.id; audit('老板确认并建立模拟订单', `${order.id} / ${key}；未收款`); save(); route('orders'); return;
  }
  if (name === 'export-quote') {
    const rows = [['item', 'quantity', 'unit_price', 'subtotal'], ...state.products.map((p, i) => [p.name, q.quantities[i], p.price, (p.price * q.quantities[i]).toFixed(2)]), ['total_USD', '', '', quoteTotal().toFixed(2)], ['quote_version', q.version, '', '']];
    const csv = rows.map(r => r.map(v => '"' + String(v).replaceAll('"', '""') + '"').join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], {type: 'text/csv;charset=utf-8'}));
    const a = document.createElement('a'); a.href = url; a.download = `quote-v${q.version}-demo.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); return;
  }
  if (name === 'production-note') {
    const o = currentOrder(), oldNote = o.note;
    openModal('记录生产进度', '仅记录备注，不代表工厂真实状态核验。', textarea('进度说明', 'note', o.note, 'required maxlength="500"'), f => { if (o.note !== oldNote) throw Error('备注已变化，请重试。'); o.note = f.get('note').trim(); audit('人工记录生产进度', `${o.id} / ${o.note}`); }); return;
  }
  if (name === 'record-balance') {
    const o = currentOrder();
    if (o.balanceRecorded) return;
    openModal('记录平台外尾款', '本操作不收款、不核验到账，只记录用户确认的结果。', `<div class="notice">待记收 US$${money(o.total - o.deposit)}</div><label class="row small" style="margin-top:18px"><input style="width:auto" type="checkbox" name="confirmed" required>我已在平台外核对到账（演示）</label>`, f => {
      if (!f.has('confirmed')) throw Error('需核对到账后才能记录。'); o.balanceRecorded = true; audit('人工记收平台外尾款', `${o.id} / US$${money(o.total - o.deposit)}，未经平台核验`);
    }, '确认记录'); return;
  }
  if (name === 'ship-order') {
    const o = currentOrder();
    if (!o.balanceRecorded || o.shipped) throw Error('需先记录尾款，已发货的订单不能重复登记。');
    openModal('登记发货', '确认已实际发货后填写；此处为模拟记录。', field('发货日期', 'date', '', 'date', 'required') + field('提单号', 'bill', '', 'text', 'required maxlength="100"'), f => { o.shipped = true; o.shipDate = f.get('date'); o.bill = f.get('bill').trim(); audit('人工登记发货', `${o.id} / ${o.shipDate} / ${o.bill}`); }); return;
  }
  if (name === 'complete-order') {
    const o = currentOrder();
    if (!o.shipped || !o.balanceRecorded || o.completed) throw Error('需先核对尾款并登记发货。');
    openModal('确认收货并完成', '需要人工确认买家已收货。', '<label class="row small"><input type="checkbox" name="received" required style="width:auto">已确认买家收货（演示）</label>', f => { if (!f.has('received')) throw Error('请确认收货。'); o.completed = true; audit('模拟订单完成', o.id + ' / 人工确认收货'); }, '确认完成'); return;
  }
  if (name === 'order-customer') { state.customerId = currentOrder().customerId; save(); route('customers'); return; }
  if (name === 'apply-pending') {
    const op = state.pending[ui.page];
    if (!op) return;
    applyOperation(ui.page, op); delete state.pending[ui.page]; commit(); return;
  }
  if (name === 'cancel-pending') { delete state.pending[ui.page]; message(ui.page, 'system', '已取消待确认修改，左侧未写入。'); commit(); return; }
  if (name === 'chat-back') { ui.chatRoomOpen = false; render(); return; }
  if (name === 'chat-summary') {
    const c = state.chats.find(x => x.id === state.chatId);
    if (!['service', 'kl', 'project'].includes(c.id)) { toast('此会话暂无结构化需求，演示不会编造摘要。'); return; }
    serviceSummary();
    if (c.id !== 'service') c.messages.push({who: 'agent', name: '客服 Agent', text: '已提取预置示例中的数量与目的港，内部同步给客户管理 Agent。没有向外部发送消息。', time: timeNow()});
    commit(); toast('需求已内部交接，可在客户管理查看。'); return;
  }
  if (name === 'history') { showHistory(); return; }
  if (name === 'settings') {
    openModal('演示设置', '数据仅保存在当前浏览器；访客之间不共享。没有后台、真实模型或渠道连接。', '<p class="small muted">Agent 的“可编辑”与“仅建议”可在各栏目对话框上方切换。对外发布、价格、订单和收款始终要求人工操作。</p><div class="section-gap"><button type="button" class="danger" data-action="reset">重置全部演示数据</button></div>', () => {}, '完成'); return;
  }
  if (name === 'reset') { state = freshState(); ui.customerSearch = ''; ui.chatSearch = ''; ui.chatRoomOpen = false; $('#dialog').close(); commit(); toast('演示数据已重置。'); }
}

function showHistory() {
  modalHandler = null;
  $('#dialog-body').innerHTML = `<div class="dialog-head"><div class="row spread"><h2>操作与交接记录</h2><button data-action="close-dialog">关闭</button></div><p>所有事件为本地演示；撤销受版本检查保护。</p></div><div class="dialog-body">${state.audit.length ? state.audit.slice(0, 60).map(e => `<div class="history-entry"><strong>${h(e.action)}</strong>${h(e.detail)}<br><small>${h(e.time)} / #${e.id}${e.undone ? ' / 已撤销' : ''}</small>${e.change && !e.undone ? `<p><button data-undo="${e.id}">撤销此修改</button></p>` : ''}</div>`).join('') : '<p class="small muted">还没有操作记录。修改资料或执行交接后会显示在这里。</p>'}</div>`;
  if (!$('#dialog').open) $('#dialog').showModal();
}

function handleForm(form) {
  const f = new FormData(form), kind = form.dataset.form;
  if (form.id === 'modal-form') {
    modalHandler?.(f); $('#dialog').close(); commit(); toast('已保存本地演示记录。'); return;
  }
  if (kind === 'market') {
    for (const key of ['country', 'buyer', 'focus', 'report']) state.market[key] = f.get(key).trim();
    state.market.version++; audit('人工保存市场方向', `市场分析 v${state.market.version}，仍为待验证假设`);
  } else if (kind === 'product') {
    const p = currentProduct(), before = structuredClone(p);
    p.positioning = f.get('positioning').trim(); p.advantages = f.get('advantages').trim(); p.version++;
    invalidateDraft(p.id); audit('人工保存产品分析', `${p.id} / v${p.version}`, {kind: 'product', id: p.id, before, expectedVersion: p.version});
  } else if (kind === 'draft') {
    updateDraft(f.get('title').trim(), f.get('body').trim());
  } else if (kind === 'publication') {
    const d = state.draft;
    if (d.approvedVersion !== d.version) throw Error('内容变更后需要重新批准。');
    let url;
    try { url = new URL(f.get('url')); } catch { throw Error('请输入有效链接。'); }
    if (url.protocol !== 'https:' || !['facebook.com', 'www.facebook.com', 'm.facebook.com', 'fb.watch'].includes(url.hostname) || url.pathname === '/') throw Error('请输入 HTTPS Facebook 帖子链接。');
    d.publication = {url: url.href, version: d.version, time: timeNow()};
    audit('登记人工发布', `内容 v${d.version} / ${url.href} / 未核验平台状态`);
  } else if (kind === 'agent') {
    const text = f.get('message').trim(); if (!text) return;
    runAgent(ui.page, text);
  } else if (kind === 'chat') {
    const text = f.get('message').trim(); if (!text) return;
    const c = state.chats.find(x => x.id === state.chatId);
    c.messages.push({who: 'self', name: '李总', text, time: timeNow()});
    if (c.type === 'agent') {
      if (/摘要|同步|客户/.test(text)) serviceSummary();
      else c.messages.push({who: 'agent', name: '客服 Agent', text: /SGS|认证|价格|报价/.test(text) ? '这涉及认证或价格承诺，需要人工核实。可以先记录待办；我不会自行承诺。' : '这是本地规则演示，未连接真实模型。可以试试“同步客户需求”，把预置示例的摘要交给客户管理 Agent。', time: timeNow()});
    }
    c.messages = c.messages.slice(-150);
    audit('保存本地消息', c.name + '；没有对外发送'); ui.chatRoomOpen = true;
  }
  commit();
}

document.addEventListener('click', event => {
  const target = event.target.closest('button,a,tr[data-select-customer],[data-action]');
  if (!target || target.disabled) return;
  try {
    if (target.dataset.action) { event.preventDefault(); action(target.dataset.action); }
    else if (target.dataset.space) {
      const key = target.dataset.space;
      if (ui.page === 'home') { ui.homeSpace = key; render(); }
      else route(key === 'acquire' ? 'market' : 'customers');
    } else if (target.dataset.product) { state.productId = target.dataset.product; commit(); }
    else if (target.dataset.selectCustomer) { state.customerId = target.dataset.selectCustomer; commit(); }
    else if (target.dataset.order) { state.selectedOrder = target.dataset.order; commit(); }
    else if (target.dataset.example) { runAgent(ui.page, target.dataset.example); commit(); }
    else if (target.dataset.chatFilter) { ui.chatFilter = target.dataset.chatFilter; render(); }
    else if (target.dataset.chat) { state.chatId = target.dataset.chat; state.chats.find(x => x.id === state.chatId).unread = 0; ui.chatRoomOpen = true; commit(); }
    else if (target.dataset.undo) { undoChange(Number(target.dataset.undo)); save(); render(); showHistory(); toast('修改已撤销，已建立新的恢复版本。'); }
  } catch (err) { toast(err.message); }
});
document.addEventListener('submit', event => {
  event.preventDefault();
  try {
    const required = [...event.target.querySelectorAll('[required]')].filter(el => ['text', 'textarea', 'url'].includes(el.type));
    if (required.some(el => !el.value.trim())) throw Error('必填内容不能只包含空格。');
    handleForm(event.target);
  } catch (err) { toast(err.message); }
});
document.addEventListener('change', event => {
  const el = event.target;
  try {
    if (el.id === 'agent-scope') { state.scopes[ui.page] = el.value; audit('修改 Agent 操作范围', META[ui.page][0] + ' / ' + (el.value === 'edit' ? '可编辑' : '仅建议')); save(); }
    else if (el.dataset.quantity !== undefined) {
      const value = Number(el.value);
      if (!Number.isInteger(value) || value < 1 || value > 1000000) { render(); throw Error('数量须为 1～1,000,000 的整数。'); }
      if (state.quote.quantities[Number(el.dataset.quantity)] !== value) { state.quote.quantities[Number(el.dataset.quantity)] = value; reviseQuote(); commit(); }
    } else if (el.id === 'delivery-days') {
      const days = Number(el.value);
      if (!Number.isInteger(days) || days < 1 || days > 365) { render(); throw Error('交期须为 1～365 天。'); }
      if (days !== state.quote.delivery) { state.quote.delivery = days; reviseQuote(); commit(); }
    } else if (el.id === 'quote-customer') { state.quote.customerId = el.value; reviseQuote(); commit(); }
    else if (el.id === 'agent-file' || el.id === 'chat-file') {
      const file = el.files[0]; if (!file) return;
      if (file.size > 20 * 1024 * 1024) { el.value = ''; throw Error('演示附件大小请控制在 20 MB 以内。'); }
      if (el.id === 'agent-file') {
        state.files.push({page: ui.page, name: file.name, note: '仅记录文件名，未上传或解析'});
        message(ui.page, 'system', `已记录附件名称：${file.name}。正文未读取、未上传、未用于生成分析。`);
      } else state.chats.find(x => x.id === state.chatId).messages.push({who: 'self', name: '李总', text: `附件记录：${file.name}\n（仅文件名，未上传或发送）`, time: timeNow()});
      audit('记录附件名称', file.name + '；未读取正文'); commit();
    }
  } catch (err) { toast(err.message); }
});
document.addEventListener('input', event => {
  const el = event.target;
  if (!['customer-search', 'chat-search'].includes(el.id)) return;
  const position = el.selectionStart, id = el.id;
  if (id === 'customer-search') ui.customerSearch = el.value; else ui.chatSearch = el.value;
  render(); $( '#' + id).focus(); $( '#' + id).setSelectionRange(position, position);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Enter' && event.target.matches('tr[data-select-customer]')) { event.preventDefault(); state.customerId = event.target.dataset.selectCustomer; commit(); }
  if (event.key === 'Escape' && ui.agentOpen) { ui.agentOpen = false; render(); }
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.target.matches('[data-form="chat"] textarea')) { event.preventDefault(); event.target.closest('form').requestSubmit(); }
});
render();
