/**
 * Generate 15 FASTMARK UML Use Case diagrams (.drawio) for diagrams.net
 * 1 overview + 14 detail diagrams (by use case domain, not by actor)
 *
 * Run: node docs/diagrams/generate-uc-fastmark-15.js
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'use-case');

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const STYLE = {
  actor:
    'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;fillColor=#fff2cc;strokeColor=#d6b656;fontStyle=1;fontSize=13;',
  uc: 'ellipse;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=12;',
  ucMain:
    'ellipse;whiteSpace=wrap;html=1;fillColor=#b1ddf0;strokeColor=#0066CC;fontStyle=1;fontSize=12;strokeWidth=2;',
  system:
    'rounded=0;whiteSpace=wrap;html=1;fillColor=#FAFAFA;strokeColor=#333333;strokeWidth=2;verticalAlign=top;fontStyle=1;fontSize=16;spacingTop=10;align=center;',
  title:
    'text;html=1;strokeColor=none;fillColor=none;align=center;fontStyle=1;fontSize=20;fontColor=#333333;',
  note:
    'shape=note;whiteSpace=wrap;html=1;size=14;fillColor=#FFF9E6;strokeColor=#d6b656;fontSize=11;align=left;spacingLeft=8;',
};

const EDGE = {
  assoc: 'endArrow=none;html=1;rounded=0;strokeColor=#444444;strokeWidth=1.5;',
  include:
    'endArrow=open;dashed=1;html=1;endFill=0;strokeColor=#0066CC;fontSize=11;fontColor=#0066CC;labelBackgroundColor=#ffffff;',
  extend:
    'endArrow=open;dashed=1;html=1;endFill=0;strokeColor=#CC6600;fontSize=11;fontColor=#CC6600;labelBackgroundColor=#ffffff;',
  generalization:
    'endArrow=block;endFill=0;html=1;endSize=14;strokeColor=#333333;strokeWidth=1.5;',
};

function cell(id, value, x, y, w, h, style, parent = '1') {
  return `<mxCell id="${id}" value="${esc(value)}" style="${style}" vertex="1" parent="${parent}">
          <mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/>
        </mxCell>`;
}

function edge(id, source, target, label = '', style = EDGE.assoc) {
  const value = label ? ` value="${esc(label)}"` : '';
  return `<mxCell id="${id}"${value} style="${style}" edge="1" parent="1" source="${source}" target="${target}">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>`;
}

function mxfile(name, pageW, pageH, cells) {
  return `<mxfile host="app.diagrams.net" modified="2026-08-02T00:00:00.000Z" agent="FastMark-UC-Generator" version="22.1.0" type="device">
  <diagram id="${esc(name)}" name="${esc(name)}">
    <mxGraphModel dx="1600" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${pageW}" pageHeight="${pageH}" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
${cells.join('\n')}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
`;
}

/** @param {object} spec */
function buildDiagram(spec) {
  const {
    title,
    diagramName,
    pageW = 1400,
    pageH = 900,
    systemX = 200,
    systemY = 70,
    systemW = 1100,
    systemH = 780,
    systemLabel = 'FASTMARK',
    actors = [],
    useCases = [],
    associations = [],
    includes = [],
    extendsRel = [],
    generalizations = [],
    note,
  } = spec;

  const cells = [];
  cells.push(cell('title', title, systemX, 16, systemW, 36, STYLE.title));
  cells.push(cell('sys', systemLabel, systemX, systemY, systemW, systemH, STYLE.system));

  actors.forEach((a) => {
    cells.push(cell(a.id, a.name, a.x, a.y, 55, 85, STYLE.actor));
  });

  useCases.forEach((uc) => {
    cells.push(
      cell(uc.id, uc.name, uc.x, uc.y, uc.w || 200, uc.h || 52, uc.main ? STYLE.ucMain : STYLE.uc)
    );
  });

  associations.forEach((a, i) => {
    cells.push(edge(`assoc_${i}`, a.from, a.to, '', EDGE.assoc));
  });

  includes.forEach((r, i) => {
    cells.push(edge(`inc_${i}`, r.from, r.to, '&lt;&lt;include&gt;&gt;', EDGE.include));
  });

  extendsRel.forEach((r, i) => {
    cells.push(edge(`ext_${i}`, r.from, r.to, '&lt;&lt;extend&gt;&gt;', EDGE.extend));
  });

  generalizations.forEach((r, i) => {
    cells.push(edge(`gen_${i}`, r.from, r.to, '', EDGE.generalization));
  });

  if (note) {
    cells.push(cell('note', note, systemX, systemY + systemH + 12, 420, 70, STYLE.note));
  }

  return mxfile(diagramName, pageW, pageH, cells);
}

// ---------------------------------------------------------------------------
// Diagram definitions
// ---------------------------------------------------------------------------

const diagrams = [
  {
    file: '00-UC-Tong-quan.drawio',
    content: buildDiagram({
      title: 'Sơ đồ Use Case Tổng quát – FASTMARK',
      diagramName: 'UC Tổng quát',
      pageW: 1500,
      pageH: 1000,
      systemX: 180,
      systemY: 60,
      systemW: 1200,
      systemH: 860,
      actors: [
        { id: 'user', name: 'User', x: 40, y: 180 },
        { id: 'seller', name: 'Seller', x: 40, y: 420 },
        { id: 'admin', name: 'Admin', x: 1420, y: 320 },
      ],
      useCases: [
        { id: 'uc1', name: 'Quản lý tài khoản', x: 260, y: 120, w: 220 },
        { id: 'uc2', name: 'Khám phá &amp; tìm kiếm', x: 520, y: 120, w: 240 },
        { id: 'uc3', name: 'Xem cửa hàng &amp; sản phẩm', x: 820, y: 120, w: 260 },
        { id: 'uc4', name: 'Tạo yêu cầu giữ hàng', x: 260, y: 240, w: 240 },
        { id: 'uc5', name: 'Quản lý đơn giữ hàng', x: 540, y: 240, w: 240 },
        { id: 'uc6', name: 'Đánh giá', x: 860, y: 240, w: 180 },
        { id: 'uc7', name: 'Tranh chấp &amp; khiếu nại', x: 260, y: 360, w: 240 },
        { id: 'uc8', name: 'Ví &amp; thanh toán', x: 540, y: 360, w: 200 },
        { id: 'uc9', name: 'Thông báo', x: 780, y: 360, w: 180 },
        { id: 'uc10', name: 'Xác minh Seller', x: 260, y: 500, w: 200 },
        { id: 'uc11', name: 'Quản lý cửa hàng', x: 500, y: 500, w: 220 },
        { id: 'uc12', name: 'Quản lý sản phẩm', x: 760, y: 500, w: 220 },
        { id: 'uc13', name: 'Gói Seller &amp; Banner', x: 260, y: 620, w: 240 },
        { id: 'uc14', name: 'Quản trị hệ thống', x: 540, y: 620, w: 220 },
        { id: 'uc15', name: 'Xử lý tranh chấp', x: 800, y: 620, w: 220 },
      ],
      associations: [
        { from: 'user', to: 'uc1' },
        { from: 'user', to: 'uc2' },
        { from: 'user', to: 'uc3' },
        { from: 'user', to: 'uc4' },
        { from: 'user', to: 'uc5' },
        { from: 'user', to: 'uc6' },
        { from: 'user', to: 'uc7' },
        { from: 'user', to: 'uc8' },
        { from: 'user', to: 'uc9' },
        { from: 'seller', to: 'uc10' },
        { from: 'seller', to: 'uc11' },
        { from: 'seller', to: 'uc12' },
        { from: 'seller', to: 'uc13' },
        { from: 'seller', to: 'uc5' },
        { from: 'seller', to: 'uc6' },
        { from: 'admin', to: 'uc10' },
        { from: 'admin', to: 'uc14' },
        { from: 'admin', to: 'uc15' },
        { from: 'admin', to: 'uc9' },
      ],
      generalizations: [{ from: 'seller', to: 'user' }],
      note: 'Sơ đồ tổng quát: liệt kê các nhóm chức năng chính.\nChi tiết include/extend xem 14 sơ đồ con.',
    }),
  },

  {
    file: '01-UC-Quan-ly-tai-khoan.drawio',
    content: buildDiagram({
      title: 'Chi tiết: Quản lý tài khoản',
      diagramName: 'UC Quản lý tài khoản',
      actors: [
        { id: 'user', name: 'User', x: 30, y: 260 },
        { id: 'seller', name: 'Seller', x: 30, y: 480 },
      ],
      useCases: [
        { id: 'dk', name: 'Đăng ký', x: 320, y: 120, main: true },
        { id: 'xtemail', name: 'Xác thực Email', x: 620, y: 120 },
        { id: 'dn', name: 'Đăng nhập', x: 320, y: 240, main: true },
        { id: 'kttt', name: 'Kiểm tra thông tin\nđăng nhập', x: 620, y: 240 },
        { id: 'dngg', name: 'Đăng nhập Google', x: 620, y: 360 },
        { id: 'qmk', name: 'Quên mật khẩu', x: 320, y: 360 },
        { id: 'cphs', name: 'Cập nhật hồ sơ', x: 320, y: 480 },
        { id: 'dmk', name: 'Đổi mật khẩu', x: 560, y: 480 },
        { id: 'dx', name: 'Đăng xuất', x: 800, y: 480 },
      ],
      associations: [
        { from: 'user', to: 'dk' },
        { from: 'user', to: 'dn' },
        { from: 'user', to: 'qmk' },
        { from: 'user', to: 'cphs' },
        { from: 'user', to: 'dmk' },
        { from: 'user', to: 'dx' },
        { from: 'seller', to: 'cphs' },
        { from: 'seller', to: 'dmk' },
        { from: 'seller', to: 'dx' },
      ],
      includes: [
        { from: 'dk', to: 'xtemail' },
        { from: 'dn', to: 'kttt' },
      ],
      extendsRel: [{ from: 'dngg', to: 'dn' }],
      generalizations: [{ from: 'seller', to: 'user' }],
    }),
  },

  {
    file: '02-UC-Xac-minh-Seller.drawio',
    content: buildDiagram({
      title: 'Chi tiết: Xác minh Seller',
      diagramName: 'UC Xác minh Seller',
      actors: [
        { id: 'seller', name: 'Seller', x: 30, y: 280 },
        { id: 'admin', name: 'Admin', x: 1320, y: 280 },
      ],
      useCases: [
        { id: 'ghs', name: 'Gửi hồ sơ xác minh', x: 340, y: 180, main: true },
        { id: 'cccdt', name: 'Upload CCCD trước', x: 640, y: 120 },
        { id: 'cccds', name: 'Upload CCCD sau', x: 640, y: 220 },
        { id: 'selfie', name: 'Upload Selfie', x: 640, y: 320 },
        { id: 'tt', name: 'Theo dõi trạng thái', x: 340, y: 380 },
        { id: 'duyet', name: 'Duyệt hồ sơ', x: 900, y: 220, main: true },
        { id: 'tuchoi', name: 'Từ chối hồ sơ', x: 900, y: 380 },
      ],
      associations: [
        { from: 'seller', to: 'ghs' },
        { from: 'seller', to: 'tt' },
        { from: 'admin', to: 'duyet' },
        { from: 'admin', to: 'tuchoi' },
      ],
      includes: [
        { from: 'ghs', to: 'cccdt' },
        { from: 'ghs', to: 'cccds' },
        { from: 'ghs', to: 'selfie' },
      ],
    }),
  },

  {
    file: '03-UC-Kham-pha-tim-kiem.drawio',
    content: buildDiagram({
      title: 'Chi tiết: Khám phá &amp; tìm kiếm',
      diagramName: 'UC Khám phá tìm kiếm',
      actors: [{ id: 'user', name: 'User', x: 30, y: 320 }],
      useCases: [
        { id: 'tksp', name: 'Tìm kiếm sản phẩm', x: 300, y: 120, main: true },
        { id: 'tkch', name: 'Tìm kiếm cửa hàng', x: 560, y: 120, main: true },
        { id: 'xsp', name: 'Xem sản phẩm', x: 300, y: 280, main: true },
        { id: 'xch', name: 'Xem cửa hàng', x: 560, y: 280, main: true },
        { id: 'bando', name: 'Xem bản đồ', x: 820, y: 120 },
        { id: 'gann', name: 'Xem sản phẩm gần bạn', x: 820, y: 280 },
        { id: 'yt', name: 'Yêu thích sản phẩm', x: 300, y: 480 },
        { id: 'share', name: 'Chia sẻ sản phẩm', x: 560, y: 480 },
        { id: 'follow', name: 'Theo dõi cửa hàng', x: 820, y: 480 },
      ],
      associations: [
        { from: 'user', to: 'tksp' },
        { from: 'user', to: 'tkch' },
        { from: 'user', to: 'xsp' },
        { from: 'user', to: 'xch' },
        { from: 'user', to: 'bando' },
        { from: 'user', to: 'gann' },
      ],
      extendsRel: [
        { from: 'yt', to: 'xsp' },
        { from: 'share', to: 'xsp' },
        { from: 'follow', to: 'xch' },
      ],
    }),
  },

  {
    file: '04-UC-Xem-cua-hang-san-pham.drawio',
    content: buildDiagram({
      title: 'Chi tiết: Xem cửa hàng &amp; sản phẩm',
      diagramName: 'UC Xem CH SP',
      actors: [{ id: 'user', name: 'User', x: 30, y: 300 }],
      useCases: [
        { id: 'xctch', name: 'Xem chi tiết cửa hàng', x: 280, y: 140, main: true },
        { id: 'xctsp', name: 'Xem chi tiết sản phẩm', x: 580, y: 140, main: true },
        { id: 'yt', name: 'Yêu thích sản phẩm', x: 880, y: 140 },
        { id: 'follow', name: 'Theo dõi cửa hàng', x: 280, y: 320 },
        { id: 'share', name: 'Chia sẻ sản phẩm', x: 580, y: 320 },
        { id: 'call', name: 'Gọi điện cửa hàng', x: 280, y: 500 },
        { id: 'dir', name: 'Chỉ đường đến cửa hàng', x: 580, y: 500 },
        { id: 'bc', name: 'Báo cáo cửa hàng/sản phẩm', x: 880, y: 320 },
      ],
      associations: [
        { from: 'user', to: 'xctch' },
        { from: 'user', to: 'xctsp' },
        { from: 'user', to: 'call' },
        { from: 'user', to: 'dir' },
        { from: 'user', to: 'bc' },
      ],
      extendsRel: [
        { from: 'yt', to: 'xctsp' },
        { from: 'share', to: 'xctsp' },
        { from: 'follow', to: 'xctch' },
      ],
    }),
  },

  {
    file: '05-UC-Tao-yeu-cau-giu-hang.drawio',
    content: buildDiagram({
      title: 'Chi tiết: Tạo yêu cầu giữ hàng',
      diagramName: 'UC Tạo giữ hàng',
      actors: [{ id: 'user', name: 'User', x: 30, y: 300 }],
      useCases: [
        { id: 'tao', name: 'Tạo yêu cầu giữ hàng', x: 400, y: 200, main: true, w: 260 },
        { id: 'sl', name: 'Chọn số lượng', x: 760, y: 120 },
        { id: 'time', name: 'Chọn thời gian nhận', x: 760, y: 220 },
        { id: 'phone', name: 'Xác thực số điện thoại', x: 760, y: 320 },
        { id: 'coc', name: 'Thanh toán cọc ví', x: 760, y: 420 },
        { id: 'huy', name: 'Hủy yêu cầu giữ hàng', x: 400, y: 420 },
      ],
      associations: [
        { from: 'user', to: 'tao' },
        { from: 'user', to: 'huy' },
      ],
      includes: [
        { from: 'tao', to: 'sl' },
        { from: 'tao', to: 'time' },
        { from: 'tao', to: 'phone' },
        { from: 'tao', to: 'coc' },
      ],
    }),
  },

  {
    file: '06-UC-Quan-ly-don-giu-hang.drawio',
    content: buildDiagram({
      title: 'Chi tiết: Quản lý đơn giữ hàng',
      diagramName: 'UC Quản lý đơn giữ hàng',
      actors: [
        { id: 'user', name: 'User', x: 30, y: 220 },
        { id: 'seller', name: 'Seller', x: 30, y: 480 },
      ],
      useCases: [
        { id: 'xn', name: 'Xác nhận nhận hàng', x: 320, y: 160, main: true },
        { id: 'ma', name: 'Kiểm tra mã nhận hàng', x: 620, y: 160 },
        { id: 'qr', name: 'Quét mã QR cửa hàng', x: 320, y: 300 },
        { id: 'chap', name: 'Chấp nhận giữ hàng', x: 620, y: 300, main: true },
        { id: 'tu', name: 'Từ chối giữ hàng', x: 880, y: 300 },
        { id: 'huy', name: 'Hủy đơn sau chấp nhận', x: 620, y: 460 },
        { id: 'hienqr', name: 'Hiển thị mã QR cửa hàng', x: 880, y: 460 },
      ],
      associations: [
        { from: 'user', to: 'xn' },
        { from: 'user', to: 'qr' },
        { from: 'seller', to: 'chap' },
        { from: 'seller', to: 'tu' },
        { from: 'seller', to: 'huy' },
        { from: 'seller', to: 'hienqr' },
      ],
      includes: [
        { from: 'xn', to: 'ma' },
        { from: 'qr', to: 'ma' },
      ],
    }),
  },

  {
    file: '07-UC-Tranh-chap-khieu-nai.drawio',
    content: buildDiagram({
      title: 'Chi tiết: Tranh chấp &amp; khiếu nại',
      diagramName: 'UC Tranh chấp khiếu nại',
      actors: [
        { id: 'user', name: 'User', x: 30, y: 200 },
        { id: 'seller', name: 'Seller', x: 30, y: 420 },
        { id: 'admin', name: 'Admin', x: 1320, y: 300 },
      ],
      useCases: [
        { id: 'kn', name: 'Tạo khiếu nại', x: 320, y: 140, main: true },
        { id: 'up', name: 'Upload bằng chứng', x: 620, y: 140 },
        { id: 'bc', name: 'Báo cáo vi phạm', x: 320, y: 300 },
        { id: 'ns', name: 'Báo cáo người mua\nkhông đến nhận', x: 320, y: 480 },
        { id: 'xl', name: 'Xử lý tranh chấp', x: 900, y: 180, main: true },
        { id: 'xem', name: 'Xem bằng chứng', x: 900, y: 320 },
        { id: 'qd', name: 'Ra quyết định', x: 900, y: 460 },
        { id: 'hoan', name: 'Hoàn tiền cọc', x: 1100, y: 320 },
        { id: 'dong', name: 'Đóng tranh chấp', x: 1100, y: 460 },
      ],
      associations: [
        { from: 'user', to: 'kn' },
        { from: 'user', to: 'bc' },
        { from: 'seller', to: 'bc' },
        { from: 'seller', to: 'ns' },
        { from: 'admin', to: 'xl' },
        { from: 'admin', to: 'hoan' },
        { from: 'admin', to: 'dong' },
      ],
      includes: [
        { from: 'kn', to: 'up' },
        { from: 'xl', to: 'xem' },
        { from: 'xl', to: 'qd' },
      ],
    }),
  },

  {
    file: '08-UC-Danh-gia.drawio',
    content: buildDiagram({
      title: 'Chi tiết: Đánh giá',
      diagramName: 'UC Đánh giá',
      actors: [
        { id: 'user', name: 'User', x: 30, y: 220 },
        { id: 'seller', name: 'Seller', x: 30, y: 480 },
        { id: 'admin', name: 'Admin', x: 1320, y: 320 },
      ],
      useCases: [
        { id: 'dgsp', name: 'Đánh giá sản phẩm', x: 320, y: 160, main: true },
        { id: 'upanh', name: 'Upload ảnh đánh giá', x: 620, y: 160 },
        { id: 'dgch', name: 'Đánh giá cửa hàng', x: 320, y: 300 },
        { id: 'xem', name: 'Xem đánh giá', x: 580, y: 300 },
        { id: 'sua', name: 'Sửa / xóa đánh giá', x: 320, y: 460 },
        { id: 'ph', name: 'Phản hồi đánh giá', x: 580, y: 460 },
        { id: 'kd', name: 'Kiểm duyệt đánh giá', x: 900, y: 300 },
      ],
      associations: [
        { from: 'user', to: 'dgsp' },
        { from: 'user', to: 'dgch' },
        { from: 'user', to: 'xem' },
        { from: 'user', to: 'sua' },
        { from: 'seller', to: 'ph' },
        { from: 'seller', to: 'xem' },
        { from: 'admin', to: 'kd' },
      ],
      extendsRel: [{ from: 'upanh', to: 'dgsp' }],
    }),
  },

  {
    file: '09-UC-Vi-thanh-toan.drawio',
    content: buildDiagram({
      title: 'Chi tiết: Ví &amp; thanh toán',
      diagramName: 'UC Ví thanh toán',
      actors: [
        { id: 'user', name: 'User', x: 30, y: 260 },
        { id: 'seller', name: 'Seller', x: 30, y: 480 },
      ],
      useCases: [
        { id: 'xem', name: 'Xem số dư ví', x: 320, y: 140 },
        { id: 'nap', name: 'Nạp tiền', x: 320, y: 260, main: true },
        { id: 'payos', name: 'Thanh toán PayOS', x: 620, y: 260 },
        { id: 'rut', name: 'Rút tiền', x: 320, y: 380 },
        { id: 'ls', name: 'Xem lịch sử giao dịch', x: 580, y: 140 },
        { id: 'chon', name: 'Chọn ngân hàng thụ hưởng', x: 620, y: 380 },
        { id: 'coc', name: 'Trừ cọc giữ hàng', x: 580, y: 500 },
      ],
      associations: [
        { from: 'user', to: 'xem' },
        { from: 'user', to: 'nap' },
        { from: 'user', to: 'rut' },
        { from: 'user', to: 'ls' },
        { from: 'seller', to: 'xem' },
        { from: 'seller', to: 'nap' },
        { from: 'seller', to: 'rut' },
        { from: 'seller', to: 'ls' },
      ],
      includes: [
        { from: 'nap', to: 'payos' },
        { from: 'rut', to: 'chon' },
      ],
      generalizations: [{ from: 'seller', to: 'user' }],
    }),
  },

  {
    file: '10-UC-Thong-bao.drawio',
    content: buildDiagram({
      title: 'Chi tiết: Thông báo',
      diagramName: 'UC Thông báo',
      actors: [
        { id: 'user', name: 'User', x: 30, y: 240 },
        { id: 'seller', name: 'Seller', x: 30, y: 420 },
        { id: 'admin', name: 'Admin', x: 1320, y: 280 },
      ],
      useCases: [
        { id: 'xem', name: 'Xem thông báo', x: 360, y: 180, main: true },
        { id: 'dadanh', name: 'Đánh dấu đã đọc', x: 360, y: 320 },
        { id: 'caidat', name: 'Cài đặt thông báo', x: 360, y: 460 },
        { id: 'gui', name: 'Gửi thông báo hệ thống', x: 900, y: 260, main: true },
        { id: 'push', name: 'Gửi push notification', x: 900, y: 420 },
      ],
      associations: [
        { from: 'user', to: 'xem' },
        { from: 'user', to: 'dadanh' },
        { from: 'user', to: 'caidat' },
        { from: 'seller', to: 'xem' },
        { from: 'seller', to: 'dadanh' },
        { from: 'seller', to: 'caidat' },
        { from: 'admin', to: 'gui' },
      ],
      includes: [{ from: 'gui', to: 'push' }],
      generalizations: [{ from: 'seller', to: 'user' }],
    }),
  },

  {
    file: '11-UC-Quan-ly-cua-hang.drawio',
    content: buildDiagram({
      title: 'Chi tiết: Quản lý cửa hàng',
      diagramName: 'UC Quản lý cửa hàng',
      actors: [{ id: 'seller', name: 'Seller', x: 30, y: 300 }],
      useCases: [
        { id: 'tao', name: 'Tạo cửa hàng', x: 340, y: 140, main: true },
        { id: 'cap', name: 'Cập nhật cửa hàng', x: 340, y: 260 },
        { id: 'gps', name: 'Cập nhật vị trí GPS', x: 620, y: 140 },
        { id: 'mo', name: 'Mở / đóng cửa hàng', x: 620, y: 260 },
        { id: 'qr', name: 'Xem mã QR nhận hàng', x: 340, y: 400 },
        { id: 'tk', name: 'Xem thống kê cửa hàng', x: 620, y: 400 },
      ],
      associations: [
        { from: 'seller', to: 'tao' },
        { from: 'seller', to: 'cap' },
        { from: 'seller', to: 'gps' },
        { from: 'seller', to: 'mo' },
        { from: 'seller', to: 'qr' },
        { from: 'seller', to: 'tk' },
      ],
    }),
  },

  {
    file: '12-UC-Quan-ly-san-pham.drawio',
    content: buildDiagram({
      title: 'Chi tiết: Quản lý sản phẩm',
      diagramName: 'UC Quản lý sản phẩm',
      actors: [{ id: 'seller', name: 'Seller', x: 30, y: 300 }],
      useCases: [
        { id: 'them', name: 'Thêm sản phẩm', x: 320, y: 140, main: true },
        { id: 'anh', name: 'Upload ảnh', x: 620, y: 100 },
        { id: 'gia', name: 'Thiết lập giá', x: 620, y: 200 },
        { id: 'bt', name: 'Thêm biến thể', x: 620, y: 300 },
        { id: 'sua', name: 'Sửa sản phẩm', x: 320, y: 300 },
        { id: 'xoa', name: 'Xóa sản phẩm', x: 320, y: 420 },
        { id: 'ton', name: 'Quản lý tồn kho', x: 580, y: 420 },
        { id: 'bienthe', name: 'Quản lý biến thể', x: 840, y: 420 },
        { id: 'km', name: 'Quản lý khuyến mãi', x: 580, y: 540 },
      ],
      associations: [
        { from: 'seller', to: 'them' },
        { from: 'seller', to: 'sua' },
        { from: 'seller', to: 'xoa' },
        { from: 'seller', to: 'ton' },
        { from: 'seller', to: 'bienthe' },
        { from: 'seller', to: 'km' },
      ],
      includes: [
        { from: 'them', to: 'anh' },
        { from: 'them', to: 'gia' },
        { from: 'them', to: 'bt' },
      ],
    }),
  },

  {
    file: '13-UC-Goi-Seller-Banner.drawio',
    content: buildDiagram({
      title: 'Chi tiết: Gói Seller &amp; Banner',
      diagramName: 'UC Gói Seller Banner',
      actors: [
        { id: 'seller', name: 'Seller', x: 30, y: 280 },
        { id: 'admin', name: 'Admin', x: 1320, y: 280 },
      ],
      useCases: [
        { id: 'dkgoi', name: 'Đăng ký gói Seller', x: 340, y: 160, main: true },
        { id: 'mua', name: 'Mua banner quảng cáo', x: 340, y: 320, main: true },
        { id: 'xem', name: 'Xem banner đang hiển thị', x: 340, y: 480 },
        { id: 'tru', name: 'Thanh toán bằng ví', x: 640, y: 240 },
        { id: 'qlgoi', name: 'Quản lý gói Seller', x: 900, y: 160 },
        { id: 'qlbanner', name: 'Quản lý banner', x: 900, y: 320 },
      ],
      associations: [
        { from: 'seller', to: 'dkgoi' },
        { from: 'seller', to: 'mua' },
        { from: 'seller', to: 'xem' },
        { from: 'admin', to: 'qlgoi' },
        { from: 'admin', to: 'qlbanner' },
      ],
      includes: [
        { from: 'dkgoi', to: 'tru' },
        { from: 'mua', to: 'tru' },
      ],
    }),
  },

  {
    file: '14-UC-Quan-tri-he-thong.drawio',
    content: buildDiagram({
      title: 'Chi tiết: Quản trị hệ thống',
      diagramName: 'UC Quản trị hệ thống',
      pageW: 1500,
      pageH: 950,
      systemW: 1200,
      actors: [{ id: 'admin', name: 'Admin', x: 40, y: 320 }],
      useCases: [
        { id: 'u1', name: 'Quản lý người dùng', x: 280, y: 120, main: true },
        { id: 'u2', name: 'Quản lý sản phẩm', x: 540, y: 120 },
        { id: 'u3', name: 'Quản lý cửa hàng', x: 800, y: 120 },
        { id: 'u4', name: 'Quản lý danh mục', x: 280, y: 260 },
        { id: 'u5', name: 'Quản lý banner', x: 540, y: 260 },
        { id: 'u6', name: 'Xem báo cáo thống kê', x: 800, y: 260 },
        { id: 'u7', name: 'Quản lý rút tiền', x: 280, y: 400 },
        { id: 'u8', name: 'Xem nhật ký hệ thống', x: 540, y: 400 },
        { id: 'u9', name: 'Quản lý gói Seller', x: 800, y: 400 },
        { id: 'u10', name: 'Quản lý ngân hàng', x: 540, y: 540 },
      ],
      associations: [
        { from: 'admin', to: 'u1' },
        { from: 'admin', to: 'u2' },
        { from: 'admin', to: 'u3' },
        { from: 'admin', to: 'u4' },
        { from: 'admin', to: 'u5' },
        { from: 'admin', to: 'u6' },
        { from: 'admin', to: 'u7' },
        { from: 'admin', to: 'u8' },
        { from: 'admin', to: 'u9' },
        { from: 'admin', to: 'u10' },
      ],
    }),
  },
];

// ---------------------------------------------------------------------------
// Write files
// ---------------------------------------------------------------------------

if (!fs.existsSync(OUT)) {
  fs.mkdirSync(OUT, { recursive: true });
}

diagrams.forEach(({ file, content }) => {
  fs.writeFileSync(path.join(OUT, file), content, 'utf8');
  console.log('✓', file);
});

console.log(`\nDone: ${diagrams.length} diagrams → ${OUT}`);
