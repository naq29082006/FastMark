require('./config/env');

const app = require('./app');
const connectDB = require('./config/database');
const { port } = require('./config/env');

require('./config/firebaseAdmin');

connectDB();

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
