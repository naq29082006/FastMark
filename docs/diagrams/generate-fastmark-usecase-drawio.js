/**
 * Generate FASTMARK-UseCase.drawio — single file, 15 pages/tabs
 * Run: node docs/diagrams/generate-fastmark-usecase-drawio.js
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'use-case', 'FASTMARK-UseCase.drawio');

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const STYLE = {
  actor:
    'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;fillColor=#DAE8FC;strokeColor=#6C8EBF;fontStyle=1;fontSize=13;',
  uc: 'ellipse;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#6C8EBF;fontSize=12;',
  ucMain:
    'ellipse;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#2E7D32;fontStyle=1;fontSize=12;strokeWidth=2;',
  system:
    'rounded=0;whiteSpace=wrap;html=1;fillColor=#E8F5E9;strokeColor=#43A047;strokeWidth=2;verticalAlign=top;fontStyle=1;fontSize=16;fontColor=#2E7D32;spacingTop=10;align=center;',
  title:
    'text;html=1;strokeColor=none;fillColor=none;align=center;fontStyle=1;fontSize=20;fontColor=#1B5E20;',
  note:
    'shape=note;whiteSpace=wrap;html=1;size=14;fillColor=#FFFDE7;strokeColor=#F9A825;fontSize=11;align=left;spacingLeft=8;',
};

const EDGE = {
  assoc: 'endArrow=none;html=1;rounded=0;strokeColor=#455A64;strokeWidth=1.5;',
  include:
    'endArrow=open;dashed=1;dashPattern=8 4;html=1;endFill=0;strokeColor=#1565C0;fontSize=11;fontColor=#1565C0;labelBackgroundColor=#FFFFFF;',
  extend:
    'endArrow=open;dashed=1;dashPattern=8 4;html=1;endFill=0;strokeColor=#E65100;fontSize=11;fontColor=#E65100;labelBackgroundColor=#FFFFFF;',
  generalization:
    'endArrow=block;endFill=0;html=1;endSize=14;strokeColor=#37474F;strokeWidth=1.5;',
};

function cell(id, value, x, y, w, h, style, parent = '1') {
  return `<mxCell id="${id}" value="${esc(value)}" style="${style}" vertex="1" parent="${parent}">
          <mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/>
        </mxCell>`;
}

function mkEdge(id, source, target, label = '', style = EDGE.assoc) {
  const value = label ? ` value="${esc(label)}"` : '';
  return `<mxCell id="${id}"${value} style="${style}" edge="1" parent="1" source="${source}" target="${target}">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>`;
}

function buildPage(spec) {
  const {
    pageName,
    title,
    pageW = 1500,
    pageH = 950,
    systemX = 220,
    systemY = 70,
    systemW = 1050,
    systemH = 820,
    actors = [],
    useCases = [],
    associations = [],
    includes = [],
    extendsRel = [],
    generalizations = [],
    note,
  } = spec;

  const cells = [];
  cells.push(cell('title', title, systemX, 14, systemW, 36, STYLE.title));
  cells.push(cell('sys', 'FASTMARK', systemX, systemY, systemW, systemH, STYLE.system));

  actors.forEach((a) => cells.push(cell(a.id, a.name, a.x, a.y, 60, 90, STYLE.actor)));

  useCases.forEach((uc) => {
    cells.push(
      cell(
        uc.id,
        uc.name,
        uc.x,
        uc.y,
        uc.w || 210,
        uc.h || 54,
        uc.main ? STYLE.ucMain : STYLE.uc
      )
    );
  });

  associations.forEach((a, i) => cells.push(mkEdge(`a${i}`, a.from, a.to)));
  includes.forEach((r, i) => cells.push(mkEdge(`i${i}`, r.from, r.to, '&lt;&lt;include&gt;&gt;', EDGE.include)));
  extendsRel.forEach((r, i) => cells.push(mkEdge(`e${i}`, r.from, r.to, '&lt;&lt;extend&gt;&gt;', EDGE.extend)));
  generalizations.forEach((r, i) => cells.push(mkEdge(`g${i}`, r.from, r.to, '', EDGE.generalization)));

  if (note) {
    cells.push(cell('note', note, systemX, systemY + systemH + 10, 480, 72, STYLE.note));
  }

  return `  <diagram id="${esc(pageName)}" name="${esc(pageName)}">
    <mxGraphModel dx="1600" dy="960" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${pageW}" pageHeight="${pageH}" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
${cells.join('\n')}
      </root>
    </mxGraphModel>
  </diagram>`;
}

const BUYER_L = { id: 'buyer', name: 'Buyer\n(Người mua)', x: 30, y: 280 };
const SELLER_L = { id: 'seller', name: 'Seller\n(Người bán)', x: 30, y: 500 };
const ADMIN_R = { id: 'admin', name: 'Admin', x: 1340, y: 300 };
const ADMIN_L = { id: 'admin', name: 'Admin', x: 30, y: 320 };
const GEN_SELLER_BUYER = [{ from: 'seller', to: 'buyer' }];

const pages = [
  buildPage({
    pageName: '00. Use Case Tổng quát',
    title: 'Sơ đồ Use Case Tổng quát – FASTMARK',
    pageH: 1000,
    systemH: 880,
    actors: [
      { ...BUYER_L, y: 200 },
      { ...SELLER_L, y: 420 },
      { ...ADMIN_R, y: 280 },
    ],
    useCases: [
      { id: 'u01', name: 'Quản lý tài khoản', x: 280, y: 110, w: 220 },
      { id: 'u02', name: 'Xác minh người bán', x: 540, y: 110, w: 220 },
      { id: 'u03', name: 'Khám phá SP & gian hàng', x: 800, y: 110, w: 240 },
      { id: 'u04', name: 'Theo dõi & yêu thích', x: 280, y: 220, w: 220 },
      { id: 'u05', name: 'Quản lý gian hàng', x: 540, y: 220, w: 220 },
      { id: 'u06', name: 'Quản lý sản phẩm', x: 800, y: 220, w: 220 },
      { id: 'u07', name: 'Giữ hàng', x: 280, y: 330, w: 180 },
      { id: 'u08', name: 'Tranh chấp & báo cáo', x: 500, y: 330, w: 240 },
      { id: 'u09', name: 'Đánh giá', x: 780, y: 330, w: 180 },
      { id: 'u10', name: 'Ví điện tử', x: 280, y: 440, w: 180 },
      { id: 'u11', name: 'Gói dịch vụ & quảng cáo', x: 500, y: 440, w: 260 },
      { id: 'u12', name: 'Thông báo', x: 800, y: 440, w: 180 },
      { id: 'u13', name: 'Quản trị người dùng', x: 380, y: 560, w: 240 },
      { id: 'u14', name: 'Quản trị hệ thống', x: 680, y: 560, w: 240 },
    ],
    associations: [
      { from: 'buyer', to: 'u01' },
      { from: 'buyer', to: 'u03' },
      { from: 'buyer', to: 'u04' },
      { from: 'buyer', to: 'u07' },
      { from: 'buyer', to: 'u08' },
      { from: 'buyer', to: 'u09' },
      { from: 'buyer', to: 'u10' },
      { from: 'buyer', to: 'u12' },
      { from: 'buyer', to: 'u02' },
      { from: 'seller', to: 'u05' },
      { from: 'seller', to: 'u06' },
      { from: 'seller', to: 'u07' },
      { from: 'seller', to: 'u08' },
      { from: 'seller', to: 'u09' },
      { from: 'seller', to: 'u11' },
      { from: 'seller', to: 'u12' },
      { from: 'admin', to: 'u02' },
      { from: 'admin', to: 'u08' },
      { from: 'admin', to: 'u10' },
      { from: 'admin', to: 'u11' },
      { from: 'admin', to: 'u12' },
      { from: 'admin', to: 'u13' },
      { from: 'admin', to: 'u14' },
    ],
    generalizations: GEN_SELLER_BUYER,
    note: 'Sơ đồ tổng quát – chi tiết include/extend xem tab 01–14.',
  }),

  buildPage({
    pageName: '01. Quản lý tài khoản',
    title: 'Chi tiết: Quản lý tài khoản',
    actors: [BUYER_L, SELLER_L],
    useCases: [
      { id: 'dk', name: 'Đăng ký tài khoản', x: 320, y: 120, main: true },
      { id: 'xt', name: 'Xác thực email', x: 620, y: 120 },
      { id: 'dn', name: 'Đăng nhập', x: 320, y: 240, main: true },
      { id: 'kt', name: 'Kiểm tra thông tin\nđăng nhập', x: 620, y: 240 },
      { id: 'dx', name: 'Đăng xuất', x: 320, y: 360 },
      { id: 'qmk', name: 'Quên mật khẩu', x: 560, y: 360 },
      { id: 'hs', name: 'Cập nhật hồ sơ cá nhân', x: 320, y: 480 },
      { id: 'av', name: 'Thay đổi ảnh đại diện', x: 580, y: 480 },
    ],
    associations: [
      { from: 'buyer', to: 'dk' },
      { from: 'buyer', to: 'dn' },
      { from: 'buyer', to: 'dx' },
      { from: 'buyer', to: 'qmk' },
      { from: 'buyer', to: 'hs' },
      { from: 'buyer', to: 'av' },
      { from: 'seller', to: 'hs' },
      { from: 'seller', to: 'av' },
      { from: 'seller', to: 'dx' },
    ],
    includes: [
      { from: 'dk', to: 'xt' },
      { from: 'dn', to: 'kt' },
    ],
    generalizations: GEN_SELLER_BUYER,
  }),

  buildPage({
    pageName: '02. Xác minh người bán',
    title: 'Chi tiết: Xác minh người bán',
    actors: [BUYER_L, ADMIN_R],
    useCases: [
      { id: 'dkk', name: 'Đăng ký xác minh\nngười bán', x: 340, y: 160, main: true },
      { id: 'c1', name: 'Upload CCCD\nmặt trước', x: 640, y: 100 },
      { id: 'c2', name: 'Upload CCCD\nmặt sau', x: 640, y: 200 },
      { id: 'sf', name: 'Upload ảnh selfie', x: 640, y: 300 },
      { id: 'tt', name: 'Nhập thông tin\ngian hàng', x: 640, y: 400 },
      { id: 'duyet', name: 'Duyệt người bán', x: 920, y: 220, main: true },
      { id: 'tc', name: 'Từ chối xác minh\nngười bán', x: 920, y: 380 },
    ],
    associations: [
      { from: 'buyer', to: 'dkk' },
      { from: 'admin', to: 'duyet' },
      { from: 'admin', to: 'tc' },
    ],
    includes: [
      { from: 'dkk', to: 'c1' },
      { from: 'dkk', to: 'c2' },
      { from: 'dkk', to: 'sf' },
      { from: 'dkk', to: 'tt' },
    ],
  }),

  buildPage({
    pageName: '03. Khám phá sản phẩm & gian hàng',
    title: 'Chi tiết: Khám phá sản phẩm & gian hàng',
    actors: [BUYER_L],
    useCases: [
      { id: 'xsp', name: 'Xem sản phẩm', x: 320, y: 140, main: true },
      { id: 'tk', name: 'Tìm kiếm sản phẩm', x: 620, y: 100 },
      { id: 'loc', name: 'Lọc sản phẩm', x: 620, y: 200 },
      { id: 'xct', name: 'Xem chi tiết sản phẩm', x: 320, y: 300 },
      { id: 'xgh', name: 'Xem gian hàng', x: 620, y: 340, main: true },
      { id: 'kpg', name: 'Khám phá gian hàng', x: 320, y: 460 },
    ],
    associations: [
      { from: 'buyer', to: 'xsp' },
      { from: 'buyer', to: 'xct' },
      { from: 'buyer', to: 'xgh' },
      { from: 'buyer', to: 'kpg' },
    ],
    extendsRel: [
      { from: 'tk', to: 'xsp' },
      { from: 'loc', to: 'xsp' },
    ],
  }),

  buildPage({
    pageName: '04. Theo dõi & yêu thích',
    title: 'Chi tiết: Theo dõi & yêu thích',
    actors: [BUYER_L],
    useCases: [
      { id: 'xgh', name: 'Xem gian hàng', x: 340, y: 160, main: true },
      { id: 'td', name: 'Theo dõi gian hàng', x: 640, y: 120 },
      { id: 'btd', name: 'Bỏ theo dõi gian hàng', x: 640, y: 240 },
      { id: 'xct', name: 'Xem chi tiết sản phẩm', x: 340, y: 400, main: true },
      { id: 'yt', name: 'Yêu thích sản phẩm', x: 640, y: 360 },
      { id: 'byt', name: 'Bỏ yêu thích sản phẩm', x: 640, y: 480 },
    ],
    associations: [
      { from: 'buyer', to: 'xgh' },
      { from: 'buyer', to: 'xct' },
    ],
    extendsRel: [
      { from: 'td', to: 'xgh' },
      { from: 'btd', to: 'xgh' },
      { from: 'yt', to: 'xct' },
      { from: 'byt', to: 'xct' },
    ],
  }),

  buildPage({
    pageName: '05. Quản lý gian hàng',
    title: 'Chi tiết: Quản lý gian hàng',
    actors: [BUYER_L, SELLER_L],
    useCases: [
      { id: 'cap', name: 'Cập nhật thông tin\ngian hàng', x: 360, y: 180, main: true },
      { id: 'tk', name: 'Xem thống kê gian hàng', x: 360, y: 320 },
      { id: 'cd', name: 'Cài đặt shop', x: 360, y: 460 },
    ],
    associations: [
      { from: 'seller', to: 'cap' },
      { from: 'seller', to: 'tk' },
      { from: 'seller', to: 'cd' },
    ],
    generalizations: GEN_SELLER_BUYER,
  }),

  buildPage({
    pageName: '06. Quản lý sản phẩm',
    title: 'Chi tiết: Quản lý sản phẩm',
    actors: [BUYER_L, SELLER_L],
    useCases: [
      { id: 'dang', name: 'Đăng sản phẩm', x: 300, y: 120, main: true },
      { id: 'anh', name: 'Upload ảnh sản phẩm', x: 600, y: 80 },
      { id: 'gia', name: 'Thiết lập giá', x: 600, y: 170 },
      { id: 'ton', name: 'Thiết lập tồn kho', x: 600, y: 260 },
      { id: 'cap', name: 'Cập nhật sản phẩm', x: 300, y: 280 },
      { id: 'xoa', name: 'Xóa sản phẩm', x: 300, y: 400 },
      { id: 'ql', name: 'Quản lý sản phẩm', x: 560, y: 400, main: true },
      { id: 'gg', name: 'Bật giảm giá sản phẩm', x: 300, y: 540 },
      { id: 'ghim', name: 'Ghim sản phẩm', x: 560, y: 540 },
    ],
    associations: [
      { from: 'seller', to: 'dang' },
      { from: 'seller', to: 'cap' },
      { from: 'seller', to: 'xoa' },
      { from: 'seller', to: 'ql' },
    ],
    includes: [
      { from: 'dang', to: 'anh' },
      { from: 'dang', to: 'gia' },
      { from: 'dang', to: 'ton' },
    ],
    extendsRel: [
      { from: 'gg', to: 'ql' },
      { from: 'ghim', to: 'ql' },
    ],
    generalizations: GEN_SELLER_BUYER,
  }),

  buildPage({
    pageName: '07. Giữ hàng',
    title: 'Chi tiết: Giữ hàng',
    pageH: 980,
    systemH: 860,
    actors: [BUYER_L, SELLER_L],
    useCases: [
      { id: 'dat', name: 'Đặt giữ hàng', x: 320, y: 120, main: true },
      { id: 'chsp', name: 'Chọn sản phẩm', x: 620, y: 80 },
      { id: 'chsl', name: 'Chọn số lượng', x: 620, y: 170 },
      { id: 'chtg', name: 'Chọn thời gian nhận', x: 620, y: 260 },
      { id: 'ds', name: 'Xem danh sách\nđơn giữ hàng', x: 320, y: 280 },
      { id: 'ct', name: 'Xem chi tiết\nđơn giữ hàng', x: 320, y: 400, main: true },
      { id: 'huyb', name: 'Hủy đơn giữ hàng', x: 320, y: 540 },
      { id: 'xnnh', name: 'Xác nhận nhận hàng', x: 560, y: 540 },
      { id: 'xnd', name: 'Xác nhận đơn giữ hàng', x: 620, y: 400, main: true },
      { id: 'huys', name: 'Hủy đơn giữ hàng\n(Seller)', x: 620, y: 540 },
    ],
    associations: [
      { from: 'buyer', to: 'dat' },
      { from: 'buyer', to: 'ds' },
      { from: 'buyer', to: 'ct' },
      { from: 'buyer', to: 'huyb' },
      { from: 'buyer', to: 'xnnh' },
      { from: 'seller', to: 'xnd' },
      { from: 'seller', to: 'huys' },
    ],
    includes: [
      { from: 'dat', to: 'chsp' },
      { from: 'dat', to: 'chsl' },
      { from: 'dat', to: 'chtg' },
    ],
    generalizations: GEN_SELLER_BUYER,
  }),

  buildPage({
    pageName: '08. Tranh chấp & báo cáo',
    title: 'Chi tiết: Tranh chấp & báo cáo',
    pageH: 980,
    actors: [
      { ...BUYER_L, y: 200 },
      { ...SELLER_L, y: 420 },
      { ...ADMIN_R, y: 280 },
    ],
    useCases: [
      { id: 'ct', name: 'Xem chi tiết\nđơn giữ hàng', x: 320, y: 160, main: true },
      { id: 'bcgh', name: 'Báo cáo không\ngiao hàng', x: 620, y: 120 },
      { id: 'bcnh', name: 'Báo cáo không\nnhận hàng', x: 620, y: 240 },
      { id: 'td', name: 'Theo dõi tranh chấp', x: 320, y: 320 },
      { id: 'bcvp', name: 'Báo cáo vi phạm', x: 320, y: 460, main: true },
      { id: 'lydo', name: 'Chọn lý do', x: 620, y: 420 },
      { id: 'upbc', name: 'Upload bằng chứng', x: 620, y: 520 },
      { id: 'qltc', name: 'Quản lý tranh chấp', x: 920, y: 200, main: true },
      { id: 'httc', name: 'Hoàn tiền tranh chấp', x: 920, y: 340 },
      { id: 'qlbc', name: 'Quản lý báo cáo\nvi phạm', x: 920, y: 480 },
    ],
    associations: [
      { from: 'buyer', to: 'ct' },
      { from: 'buyer', to: 'td' },
      { from: 'buyer', to: 'bcvp' },
      { from: 'seller', to: 'ct' },
      { from: 'seller', to: 'bcvp' },
      { from: 'admin', to: 'qltc' },
      { from: 'admin', to: 'qlbc' },
    ],
    includes: [
      { from: 'bcvp', to: 'lydo' },
      { from: 'bcvp', to: 'upbc' },
    ],
    extendsRel: [
      { from: 'bcgh', to: 'ct' },
      { from: 'bcnh', to: 'ct' },
      { from: 'httc', to: 'qltc' },
    ],
    generalizations: GEN_SELLER_BUYER,
  }),

  buildPage({
    pageName: '09. Đánh giá',
    title: 'Chi tiết: Đánh giá',
    actors: [
      { ...BUYER_L, y: 220 },
      { ...SELLER_L, y: 440 },
      { ...ADMIN_R, y: 300 },
    ],
    useCases: [
      { id: 'dg', name: 'Đánh giá gian hàng', x: 320, y: 180, main: true },
      { id: 'bcr', name: 'Báo cáo review', x: 580, y: 180, main: true },
      { id: 'lydo', name: 'Chọn lý do', x: 880, y: 140 },
      { id: 'upbc', name: 'Upload bằng chứng', x: 880, y: 240 },
      { id: 'qls', name: 'Quản lý đánh giá\n(Seller)', x: 580, y: 360 },
      { id: 'qla', name: 'Quản lý đánh giá\n(Admin)', x: 880, y: 380 },
    ],
    associations: [
      { from: 'buyer', to: 'dg' },
      { from: 'seller', to: 'bcr' },
      { from: 'seller', to: 'qls' },
      { from: 'admin', to: 'qla' },
    ],
    includes: [
      { from: 'bcr', to: 'lydo' },
      { from: 'bcr', to: 'upbc' },
    ],
    generalizations: GEN_SELLER_BUYER,
  }),

  buildPage({
    pageName: '10. Ví điện tử',
    title: 'Chi tiết: Ví điện tử',
    actors: [
      { ...BUYER_L, y: 220 },
      { ...SELLER_L, y: 440 },
      { ...ADMIN_R, y: 300 },
    ],
    useCases: [
      { id: 'xem', name: 'Xem ví', x: 300, y: 140 },
      { id: 'ls', name: 'Xem lịch sử\ngiao dịch ví', x: 300, y: 260 },
      { id: 'nap', name: 'Nạp tiền ví', x: 560, y: 140, main: true },
      { id: 'pttt', name: 'Chọn phương thức\nthanh toán', x: 860, y: 140 },
      { id: 'rut', name: 'Tạo yêu cầu\nrút tiền', x: 560, y: 280, main: true },
      { id: 'tknn', name: 'Nhập thông tin\ntài khoản nhận tiền', x: 860, y: 280 },
      { id: 'dyrut', name: 'Duyệt yêu cầu\nrút tiền', x: 860, y: 420 },
      { id: 'qlv', name: 'Quản lý ví\nhệ thống', x: 560, y: 420 },
    ],
    associations: [
      { from: 'buyer', to: 'xem' },
      { from: 'buyer', to: 'ls' },
      { from: 'buyer', to: 'nap' },
      { from: 'buyer', to: 'rut' },
      { from: 'seller', to: 'xem' },
      { from: 'seller', to: 'ls' },
      { from: 'seller', to: 'nap' },
      { from: 'seller', to: 'rut' },
      { from: 'admin', to: 'dyrut' },
      { from: 'admin', to: 'qlv' },
    ],
    includes: [
      { from: 'nap', to: 'pttt' },
      { from: 'rut', to: 'tknn' },
    ],
    generalizations: GEN_SELLER_BUYER,
  }),

  buildPage({
    pageName: '11. Gói dịch vụ & quảng cáo',
    title: 'Chi tiết: Gói dịch vụ & quảng cáo',
    actors: [
      { ...BUYER_L, y: 260 },
      { ...SELLER_L, y: 480 },
      { ...ADMIN_R, y: 300 },
    ],
    useCases: [
      { id: 'goi', name: 'Mua gói dịch vụ', x: 340, y: 160, main: true },
      { id: 'mua', name: 'Mua banner\nquảng cáo', x: 340, y: 320, main: true },
      { id: 'upbn', name: 'Upload banner', x: 640, y: 280 },
      { id: 'tgh', name: 'Chọn thời gian\nhiển thị', x: 640, y: 380 },
      { id: 'qls', name: 'Quản lý banner\ncủa gian hàng', x: 340, y: 480 },
      { id: 'qlgoi', name: 'Quản lý gói dịch vụ', x: 900, y: 160 },
      { id: 'qlbn', name: 'Quản lý banner\nhệ thống', x: 900, y: 300 },
      { id: 'duyet', name: 'Duyệt banner\nquảng cáo', x: 900, y: 440 },
    ],
    associations: [
      { from: 'seller', to: 'goi' },
      { from: 'seller', to: 'mua' },
      { from: 'seller', to: 'qls' },
      { from: 'admin', to: 'qlgoi' },
      { from: 'admin', to: 'qlbn' },
      { from: 'admin', to: 'duyet' },
    ],
    includes: [
      { from: 'mua', to: 'upbn' },
      { from: 'mua', to: 'tgh' },
    ],
    generalizations: GEN_SELLER_BUYER,
  }),

  buildPage({
    pageName: '12. Thông báo',
    title: 'Chi tiết: Thông báo',
    actors: [
      { ...BUYER_L, y: 240 },
      { ...SELLER_L, y: 460 },
      { ...ADMIN_R, y: 280 },
    ],
    useCases: [
      { id: 'xem', name: 'Xem thông báo', x: 360, y: 220 },
      { id: 'qltb', name: 'Quản lý thông báo\nhệ thống', x: 880, y: 220, main: true },
      { id: 'tbb', name: 'Gửi thông báo\nngười mua', x: 880, y: 360 },
      { id: 'tbs', name: 'Gửi thông báo\nngười bán', x: 880, y: 480 },
    ],
    associations: [
      { from: 'buyer', to: 'xem' },
      { from: 'seller', to: 'xem' },
      { from: 'admin', to: 'qltb' },
    ],
    extendsRel: [
      { from: 'tbb', to: 'qltb' },
      { from: 'tbs', to: 'qltb' },
    ],
    generalizations: GEN_SELLER_BUYER,
  }),

  buildPage({
    pageName: '13. Quản trị người dùng',
    title: 'Chi tiết: Quản trị người dùng',
    actors: [ADMIN_L],
    useCases: [
      { id: 'qlnd', name: 'Quản lý người dùng', x: 360, y: 160, main: true },
      { id: 'khoa', name: 'Khóa tài khoản', x: 360, y: 300 },
      { id: 'mo', name: 'Mở khóa tài khoản', x: 620, y: 300 },
      { id: 'duyet', name: 'Duyệt người bán', x: 360, y: 440 },
      { id: 'tc', name: 'Từ chối xác minh\nngười bán', x: 620, y: 440 },
    ],
    associations: [
      { from: 'admin', to: 'qlnd' },
      { from: 'admin', to: 'khoa' },
      { from: 'admin', to: 'mo' },
      { from: 'admin', to: 'duyet' },
      { from: 'admin', to: 'tc' },
    ],
  }),

  buildPage({
    pageName: '14. Quản trị hệ thống',
    title: 'Chi tiết: Quản trị hệ thống',
    pageH: 1000,
    systemH: 880,
    actors: [ADMIN_L],
    useCases: [
      { id: 'dmgh', name: 'Quản lý danh mục\ngian hàng', x: 300, y: 120 },
      { id: 'dmsp', name: 'Quản lý danh mục\nsản phẩm', x: 560, y: 120 },
      { id: 'qlsp', name: 'Quản lý sản phẩm', x: 820, y: 120, main: true },
      { id: 'qlbngh', name: 'Quản lý banner\ncủa gian hàng', x: 300, y: 260 },
      { id: 'qldg', name: 'Quản lý đánh giá', x: 560, y: 260 },
      { id: 'qlbc', name: 'Quản lý báo cáo\nvi phạm', x: 820, y: 260 },
      { id: 'tkgh', name: 'Xem thống kê\ngian hàng', x: 300, y: 400 },
      { id: 'tkall', name: 'Xem thống kê\ntoàn hệ thống', x: 560, y: 400, main: true },
    ],
    associations: [
      { from: 'admin', to: 'dmgh' },
      { from: 'admin', to: 'dmsp' },
      { from: 'admin', to: 'qlsp' },
      { from: 'admin', to: 'qlbngh' },
      { from: 'admin', to: 'qldg' },
      { from: 'admin', to: 'qlbc' },
      { from: 'admin', to: 'tkgh' },
      { from: 'admin', to: 'tkall' },
    ],
  }),
];

const content = `<mxfile host="app.diagrams.net" modified="2026-08-02T12:00:00.000Z" agent="FastMark-UC" version="22.1.0" type="device" pages="15">
${pages.join('\n')}
</mxfile>
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, content, 'utf8');
console.log(`Created ${OUT} (${pages.length} pages)`);
