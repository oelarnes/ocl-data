const { GraphQLServer } = require('graphql-yoga');
const {typeDefs, resolvers} = require('./lib/ocl-graphql.js');

const mongoose = require('mongoose');
mongoose.connect("mongodb://localhost/ocl-test");

const server = new GraphQLServer({typeDefs, resolvers});
mongoose.connection.once('open', () => {
    server.start(() => console.log('OCL GraphQL Server is running on localhost:4000')) 
})