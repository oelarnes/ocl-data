const { GraphQLServer } = require('graphql-yoga');
const typeDefs = require('./ocl-gql-types');
const resolvers = require('./ocl-resolvers');

const mongoose = require('mongoose');
mongoose.connect("mongodb://localhost/ocl-test");

const server = new GraphQLServer({typeDefs, resolvers});
mongoose.connection.once('open', () => {
    server.start(() => console.log('Server is running on localhost:4000')) 
})