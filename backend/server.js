require('./config/env');

const http = require('http');
const app = require('./app');
const connectDB = require('./config/database');
const { port } = require('./config/env');
const { initSocket } = require('./socket');

require('./config/firebaseAdmin');

connectDB();

const server = http.createServer(app);
initSocket(server);

server.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
