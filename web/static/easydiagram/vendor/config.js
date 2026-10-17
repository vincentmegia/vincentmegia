/*
 * Easy Diagram engine configuration. Loaded as the first classic script, before
 * mxClient.js, because the route CSP forbids inline scripts. It sets the
 * globals mxGraph/grapheditor read at load time so that nothing is fetched:
 * no resource bundles, no stylesheets, no stencils, no remote export.
 */
window.urlParams = window.urlParams || {};
window.mxBasePath = '/static/easydiagram/vendor';
window.mxImageBasePath = '/static/easydiagram/vendor/images';
window.mxLoadResources = false;
window.mxLoadStylesheets = false;
window.mxForceIncludes = false;
window.mxLanguage = 'en';
window.mxLanguages = [];
window.uiTheme = 'min';
window.isLocalStorage = false;
window.EXPORT_URL = null;
window.SAVE_URL = null;
window.OPEN_URL = null;
window.PROXY_URL = null;
window.RESOURCES_PATH = '/static/easydiagram/vendor/resources';
window.STENCIL_PATH = '/static/easydiagram/vendor/stencils';
window.STYLE_PATH = '/static/easydiagram/vendor/styles';
window.IMAGE_PATH = '/static/easydiagram/vendor/images';
window.SHAPES_PATH = '/static/easydiagram/vendor/shapes';
window.GRAPH_IMAGE_PATH = '/static/easydiagram/vendor/img';
window.DRAW_MATH_URL = null;
