// AWS service icons for Easy Diagram (the user: "add AWS icons that
// optionally be animated as well").
//
// These are original line-art glyphs drawn for Easy Diagram, set on a tile
// in each service's AWS category colour. They are not AWS's official
// Architecture Icons (no AWS artwork is copied or bundled); the service
// names are used only to say which service a shape stands for.
//
// A shape stores its service as the `edAws` style key and its picture as a
// standard draw.io `image=` style holding a URL-encoded SVG data URI, so a
// saved file still shows the icon when opened in upstream draw.io.
//
// Pure module (no DOM), so it's unit-tested with `node --test`.

/** AWS category colours (the 2023 Architecture Icons palette). */
export const AWS_CATEGORIES = {
  compute: { name: 'Compute', color: '#ED7100' },
  storage: { name: 'Storage', color: '#7AA116' },
  database: { name: 'Database', color: '#C925D1' },
  networking: { name: 'Networking', color: '#8C4FFF' },
  integration: { name: 'App integration', color: '#E7157B' },
  security: { name: 'Security', color: '#DD344C' },
  management: { name: 'Management', color: '#E7157B' },
  analytics: { name: 'Analytics', color: '#8C4FFF' },
  ml: { name: 'Machine learning', color: '#01A88D' },
};

// Each glyph is SVG markup drawn on a 64×64 tile, white strokes, no fill.
// Keep it to plain shapes and paths: no text, no external references.
const G = {
  ec2: '<rect x="20" y="20" width="24" height="24" rx="2"/><rect x="26" y="26" width="12" height="12" rx="1"/>'
    + '<path d="M26 14v6M32 14v6M38 14v6M26 44v6M32 44v6M38 44v6M14 26h6M14 32h6M14 38h6M44 26h6M44 32h6M44 38h6"/>',
  lambda: '<path d="M18 16h8l16 32h6M33 31L20 48"/>',
  ecs: '<rect x="13" y="24" width="11" height="16" rx="1"/><rect x="26.5" y="24" width="11" height="16" rx="1"/>'
    + '<rect x="40" y="24" width="11" height="16" rx="1"/><path d="M13 29h11M26.5 29h11M40 29h11"/>',
  eks: '<path d="M32 13l16 9v20l-16 9-16-9V22z"/><circle cx="32" cy="32" r="6"/>'
    + '<path d="M32 22v4M32 38v4M23.5 27l3.5 2M37 35l3.5 2M23.5 37l3.5-2M37 29l3.5-2"/>',
  s3: '<ellipse cx="32" cy="20" rx="16" ry="5"/><path d="M16 20l4 26q12 6 24 0l4-26"/><path d="M19 33q13 5 26 0"/>',
  efs: '<path d="M14 22h12l4 4h20v20H14z"/><path d="M19 38q4-4 8 0t8 0 8 0"/>',
  rds: '<ellipse cx="32" cy="18" rx="14" ry="5"/><path d="M18 18v28a14 5 0 0 0 28 0V18M18 32a14 5 0 0 0 28 0"/>',
  dynamodb: '<ellipse cx="28" cy="18" rx="12" ry="4.5"/><path d="M16 18v28a12 4.5 0 0 0 24 0V18M16 32a12 4.5 0 0 0 24 0"/>'
    + '<path d="M48 22l-6 10h6l-5 10"/>',
  aurora: '<ellipse cx="30" cy="20" rx="13" ry="4.5"/><path d="M17 20v26a13 4.5 0 0 0 26 0V20M17 33a13 4.5 0 0 0 26 0"/>'
    + '<path d="M48 14v8M44 18h8"/>',
  vpc: '<path d="M21 44a9 9 0 0 1 1-17.8A11 11 0 0 1 43 24a9 9 0 0 1 1 20z"/><rect x="27" y="32" width="10" height="8" rx="1"/>'
    + '<path d="M29 32v-3a3 3 0 0 1 6 0v3"/>',
  cloudfront: '<circle cx="32" cy="32" r="16"/><ellipse cx="32" cy="32" rx="7" ry="16"/><path d="M16 32h32M19 24h26M19 40h26"/>',
  route53: '<path d="M32 50s-13-13-13-24a13 13 0 0 1 26 0c0 11-13 24-13 24z"/><circle cx="32" cy="26" r="5"/>',
  elb: '<circle cx="18" cy="32" r="5"/><circle cx="46" cy="18" r="4"/><circle cx="46" cy="32" r="4"/><circle cx="46" cy="46" r="4"/>'
    + '<path d="M23 32h19M22 29l20-10M22 35l20 10"/>',
  apigw: '<path d="M24 18L14 32l10 14M40 18l10 14-10 14M35 16l-6 32"/>',
  sqs: '<rect x="12" y="24" width="11" height="16" rx="1"/><rect x="26.5" y="24" width="11" height="16" rx="1"/>'
    + '<rect x="41" y="24" width="11" height="16" rx="1"/><path d="M14 47h34M44 44l4 3-4 3"/>',
  sns: '<path d="M16 28h6l16-9v26l-16-9h-6zM22 37l3 9M44 26a8 8 0 0 1 0 12M47 21a14 14 0 0 1 0 22"/>',
  stepfunctions: '<circle cx="32" cy="15" r="4"/><rect x="23" y="26" width="18" height="12" rx="2"/><circle cx="32" cy="49" r="4"/>'
    + '<path d="M32 19v7M32 38v7"/>',
  eventbridge: '<path d="M12 32h40"/><circle cx="20" cy="18" r="4"/><circle cx="44" cy="18" r="4"/><circle cx="32" cy="46" r="4"/>'
    + '<path d="M20 22v10M44 22v10M32 32v10"/>',
  iam: '<circle cx="25" cy="24" r="6"/><path d="M13 46a12 10 0 0 1 24 0"/><circle cx="45" cy="28" r="4"/>'
    + '<path d="M45 32v14M45 40h4M45 44h3"/>',
  cognito: '<rect x="14" y="18" width="36" height="28" rx="3"/><circle cx="25" cy="30" r="4"/><path d="M19 40a6 5 0 0 1 12 0M35 28h10M35 34h8"/>',
  kms: '<circle cx="23" cy="32" r="8"/><circle cx="23" cy="32" r="2"/><path d="M31 32h19M44 32v6M50 32v6"/>',
  cloudwatch: '<circle cx="28" cy="28" r="12"/><path d="M37 37l11 11M21 31l4-5 4 5 5-8"/>',
  kinesis: '<path d="M14 24q6-5 12 0t12 0 12 0M14 32q6-5 12 0t12 0 12 0M14 40q6-5 12 0t12 0 12 0"/>',
  sagemaker: '<path d="M32 13l16 9v20l-16 9-16-9V22z"/><circle cx="32" cy="24" r="3"/><circle cx="24" cy="37" r="3"/>'
    + '<circle cx="40" cy="37" r="3"/><path d="M30.5 26.5l-5 8M33.5 26.5l5 8M27 37h10"/>',
};

/** [id, short name (default label), full name, category]. Dock order. */
const LIST = [
  ['ec2', 'EC2', 'Amazon EC2', 'compute'],
  ['lambda', 'Lambda', 'AWS Lambda', 'compute'],
  ['ecs', 'ECS', 'Amazon ECS', 'compute'],
  ['eks', 'EKS', 'Amazon EKS', 'compute'],
  ['s3', 'S3', 'Amazon S3', 'storage'],
  ['efs', 'EFS', 'Amazon EFS', 'storage'],
  ['rds', 'RDS', 'Amazon RDS', 'database'],
  ['dynamodb', 'DynamoDB', 'Amazon DynamoDB', 'database'],
  ['aurora', 'Aurora', 'Amazon Aurora', 'database'],
  ['vpc', 'VPC', 'Amazon VPC', 'networking'],
  ['cloudfront', 'CloudFront', 'Amazon CloudFront', 'networking'],
  ['route53', 'Route 53', 'Amazon Route 53', 'networking'],
  ['elb', 'Load Balancer', 'Elastic Load Balancing', 'networking'],
  ['apigw', 'API Gateway', 'Amazon API Gateway', 'integration'],
  ['sqs', 'SQS', 'Amazon SQS', 'integration'],
  ['sns', 'SNS', 'Amazon SNS', 'integration'],
  ['stepfunctions', 'Step Functions', 'AWS Step Functions', 'integration'],
  ['eventbridge', 'EventBridge', 'Amazon EventBridge', 'integration'],
  ['iam', 'IAM', 'AWS IAM', 'security'],
  ['cognito', 'Cognito', 'Amazon Cognito', 'security'],
  ['kms', 'KMS', 'AWS KMS', 'security'],
  ['cloudwatch', 'CloudWatch', 'Amazon CloudWatch', 'management'],
  ['kinesis', 'Kinesis', 'Amazon Kinesis', 'analytics'],
  ['sagemaker', 'SageMaker', 'Amazon SageMaker', 'ml'],
];

export const AWS_SERVICES = LIST.map(([id, label, name, category]) => ({
  id, label, name, category, color: AWS_CATEGORIES[category].color,
}));

const BY_ID = Object.fromEntries(AWS_SERVICES.map((s) => [s.id, s]));

/** The default service when none (or an unknown one) is given. */
export const DEFAULT_AWS_SERVICE = 'lambda';

/** A service by id, or null. */
export function awsService(id) {
  return BY_ID[id] || null;
}

/** A standalone SVG document for a service's icon: a tile in its category colour with the white glyph. */
export function awsIconSvg(id) {
  const s = BY_ID[id] || BY_ID[DEFAULT_AWS_SERVICE];
  return '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">'
    + '<defs><linearGradient id="g" x1="0" y1="1" x2="1" y2="0">'
    + `<stop offset="0" stop-color="${s.color}"/><stop offset="1" stop-color="${lighten(s.color, 0.22)}"/>`
    + '</linearGradient></defs>'
    + '<rect width="64" height="64" rx="6" fill="url(#g)"/>'
    + '<g fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">'
    + G[s.id] + '</g></svg>';
}

/**
 * The icon as a data URI that is safe inside a draw.io style string: fully
 * URL-encoded (no raw `;` or `=`), the form upstream draw.io also uses.
 */
export function awsIconDataUri(id) {
  return 'data:image/svg+xml,' + encodeURIComponent(awsIconSvg(id));
}

function lighten(hex, t) {
  const p = [1, 3, 5].map((j) => parseInt(hex.slice(j, j + 2), 16));
  return '#' + p.map((v) => Math.round(v + (255 - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase();
}
