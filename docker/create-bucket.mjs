// Creates the S3 bucket of the standard compose file when it is missing:
// one signed (AWS Signature Version 4) PUT, retried while the store starts.
import { createHash, createHmac } from "node:crypto";

const env = process.env;
const endpoint = new URL(env.S3_ENDPOINT ?? "http://s3:9000");
const bucket = env.S3_BUCKET ?? "docleus";
const region = env.S3_REGION ?? "us-east-1";
const accessKey = env.S3_ACCESS_KEY ?? "";
const secretKey = env.S3_SECRET_KEY ?? "";

const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const hmac = (key, data) => createHmac("sha256", key).update(data).digest();

function signedRequest(method, body) {
  const url = new URL(`/${encodeURIComponent(bucket)}`, endpoint);
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const day = amzDate.slice(0, 8);
  const payloadHash = sha256(body);
  const headers = {
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  const signedHeaders = Object.keys(headers).join(";");
  const canonical = [
    method,
    url.pathname,
    "",
    ...Object.entries(headers).map(([key, value]) => `${key}:${value}`),
    "",
    signedHeaders,
    payloadHash,
  ].join("\n");
  const scope = `${day}/${region}/s3/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonical)].join(
    "\n",
  );
  let key = hmac(`AWS4${secretKey}`, day);
  for (const part of [region, "s3", "aws4_request"]) key = hmac(key, part);
  const signature = createHmac("sha256", key).update(toSign).digest("hex");
  return fetch(url, {
    method,
    headers: {
      ...headers,
      authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    ...(body && { body }),
  });
}

function locationBody() {
  if (region === "us-east-1") return "";
  return `<CreateBucketConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><LocationConstraint>${region}</LocationConstraint></CreateBucketConfiguration>`;
}

for (let attempt = 1; ; attempt++) {
  try {
    const head = await signedRequest("HEAD", "");
    if (head.ok) {
      process.stdout.write(`bucket ${bucket} exists\n`);
      process.exit(0);
    }
    const created = await signedRequest("PUT", locationBody());
    if (created.ok) {
      process.stdout.write(`created bucket ${bucket}\n`);
      process.exit(0);
    }
    throw new Error(`${created.status} ${await created.text()}`);
  } catch (error) {
    if (attempt >= 30) {
      process.stderr.write(`cannot create bucket ${bucket}: ${error}\n`);
      process.exit(1);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
