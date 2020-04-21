import express from 'express';
import graphqlHTTP from 'express-graphql'
import {initialize_db} from './src/db'
import {schema} from './src/schema'

const app = express();

initialize_db().then(() => {
    console.log('SQL Database initialized');
})

app.use('/data', graphqlHTTP({
    schema,
    graphiql: true
}));

app.listen(4000, () => {
    console.log('listening on port 4000')
});
