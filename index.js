"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_graphql_1 = __importDefault(require("express-graphql"));
const db_1 = require("./src/db");
const schema_1 = require("./src/schema");
const app = express_1.default();
db_1.initialize_db().then(() => {
    console.log('SQL Database initialized');
});
app.use('/data', express_graphql_1.default({
    schema: schema_1.schema,
    graphiql: true
}));
app.listen(4000, () => {
    console.log('listening on port 4000');
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHNEQUE4QjtBQUM5QixzRUFBeUM7QUFDekMsaUNBQXNDO0FBQ3RDLHlDQUFtQztBQUVuQyxNQUFNLEdBQUcsR0FBRyxpQkFBTyxFQUFFLENBQUM7QUFFdEIsa0JBQWEsRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUU7SUFDdEIsT0FBTyxDQUFDLEdBQUcsQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO0FBQzVDLENBQUMsQ0FBQyxDQUFBO0FBRUYsR0FBRyxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUseUJBQVcsQ0FBQztJQUN6QixNQUFNLEVBQU4sZUFBTTtJQUNOLFFBQVEsRUFBRSxJQUFJO0NBQ2pCLENBQUMsQ0FBQyxDQUFDO0FBRUosR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFO0lBQ2xCLE9BQU8sQ0FBQyxHQUFHLENBQUMsd0JBQXdCLENBQUMsQ0FBQTtBQUN6QyxDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBleHByZXNzIGZyb20gJ2V4cHJlc3MnO1xuaW1wb3J0IGdyYXBocWxIVFRQIGZyb20gJ2V4cHJlc3MtZ3JhcGhxbCdcbmltcG9ydCB7aW5pdGlhbGl6ZV9kYn0gZnJvbSAnLi9zcmMvZGInXG5pbXBvcnQge3NjaGVtYX0gZnJvbSAnLi9zcmMvc2NoZW1hJ1xuXG5jb25zdCBhcHAgPSBleHByZXNzKCk7XG5cbmluaXRpYWxpemVfZGIoKS50aGVuKCgpID0+IHtcbiAgICBjb25zb2xlLmxvZygnU1FMIERhdGFiYXNlIGluaXRpYWxpemVkJyk7XG59KVxuXG5hcHAudXNlKCcvZGF0YScsIGdyYXBocWxIVFRQKHtcbiAgICBzY2hlbWEsXG4gICAgZ3JhcGhpcWw6IHRydWVcbn0pKTtcblxuYXBwLmxpc3Rlbig0MDAwLCAoKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ2xpc3RlbmluZyBvbiBwb3J0IDQwMDAnKVxufSk7XG4iXX0=