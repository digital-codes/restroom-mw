# @restroom-mw/influxdb

Is a basic middleware to make queries to [influxdb](https://www.influxdata.com/).

## usage

```js
import express from "express";
import zencode from "@restroom-mw/core";
import db from "@restroom-mw/influxdb";

const app = express();

app.use(influxdb);
app.use("/api/*", zencode);
```

## API

<!-- Generated by documentation.js. Update this documentation by updating the source code. -->

#### Table of Contents

*   [FLUX_CONNECT](#flux_connect)
    *   [Parameters](#parameters)
*   [FLUX_QUERY](#flux_query)
    *   [Parameters](#parameters-1)
*   [FLUX_QUERY_ARRAY](#flux_query_array)
    *   [Parameters](#parameters-2)

### FLUX_CONNECT

[packages/influxdb/src/index.ts:12-12](https://github.com/dyne/restroom-mw/blob/34f641c0cb7089442f3ba5c1b5831254eec67c57/packages/influxdb/src/index.ts#L12-L12 "Source code on GitHub")

Given I connect to influxdb with the connection object named 'influx'

#### Parameters

*   `influx` **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** A dictionary of the form `{token: string, url: string, org: string}`

### FLUX_QUERY

[packages/influxdb/src/index.ts:18-18](https://github.com/dyne/restroom-mw/blob/34f641c0cb7089442f3ba5c1b5831254eec67c57/packages/influxdb/src/index.ts#L18-L18 "Source code on GitHub")

Given I execute the flux query named 'query' and save the output into 'result'

#### Parameters

*   `query` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** The variable name that contains the flux query
*   `result` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** The variable name that will contain the result of the query

### FLUX_QUERY_ARRAY

[packages/influxdb/src/index.ts:24-24](https://github.com/dyne/restroom-mw/blob/34f641c0cb7089442f3ba5c1b5831254eec67c57/packages/influxdb/src/index.ts#L24-L24 "Source code on GitHub")

Given I execute the array of flux queries named 'query_array' and save the output into 'result'

#### Parameters

*   `query_array` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** The variable name that contains the array of flux queries
*   `result` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** The variable name that will contain the result of the queries