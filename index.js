"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const db_1 = require("./src/db");
const middleware_1 = require("./src/middleware");
const app = express_1.default();
db_1.initializeDb().then(() => {
    console.log('SQL Database initialized');
});
app.use('/data', middleware_1.middleware);
const server = http_1.default.createServer(app);
server.listen(4001);
console.log('GraphQL server started on port %s', server.address().port);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHNEQUE4QjtBQUM5QixnREFBd0I7QUFFeEIsaUNBQXFDO0FBQ3JDLGlEQUEyQztBQUUzQyxNQUFNLEdBQUcsR0FBRyxpQkFBTyxFQUFFLENBQUM7QUFFdEIsaUJBQVksRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUU7SUFDckIsT0FBTyxDQUFDLEdBQUcsQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO0FBQzVDLENBQUMsQ0FBQyxDQUFBO0FBRUYsR0FBRyxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsdUJBQVUsQ0FBQyxDQUFDO0FBRTdCLE1BQU0sTUFBTSxHQUFHLGNBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFnQixDQUFDO0FBRXJELE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDcEIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQ0FBbUMsRUFBRyxNQUFNLENBQUMsT0FBTyxFQUFVLENBQUMsSUFBSSxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgZXhwcmVzcyBmcm9tICdleHByZXNzJztcbmltcG9ydCBodHRwIGZyb20gJ2h0dHAnO1xuXG5pbXBvcnQge2luaXRpYWxpemVEYn0gZnJvbSAnLi9zcmMvZGInXG5pbXBvcnQge21pZGRsZXdhcmV9IGZyb20gJy4vc3JjL21pZGRsZXdhcmUnXG5cbmNvbnN0IGFwcCA9IGV4cHJlc3MoKTtcblxuaW5pdGlhbGl6ZURiKCkudGhlbigoKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ1NRTCBEYXRhYmFzZSBpbml0aWFsaXplZCcpOyBcbn0pXG5cbmFwcC51c2UoJy9kYXRhJywgbWlkZGxld2FyZSk7XG5cbmNvbnN0IHNlcnZlciA9IGh0dHAuY3JlYXRlU2VydmVyKGFwcCkgYXMgaHR0cC5TZXJ2ZXI7XG5cbnNlcnZlci5saXN0ZW4oNDAwMSk7XG5jb25zb2xlLmxvZygnR3JhcGhRTCBzZXJ2ZXIgc3RhcnRlZCBvbiBwb3J0ICVzJywgKHNlcnZlci5hZGRyZXNzKCkgYXMgYW55KS5wb3J0KTsgIl19