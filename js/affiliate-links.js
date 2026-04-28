// Affiliate link configuration — Amazon Associates
//
// Operator: Woogoro LLC (SC, Filing 260427-1134199, EIN 42-2167815)
// Tag: paste the Associates tag below once Amazon confirms the account
// is registered to woogoro.com under Woogoro LLC.
//
// Go-live procedure:
//   1. Set `tag` to the Associates tag string (e.g. "woogoro-20").
//   2. Set `enabled` to true.
//   3. Rebuild .min.js.
// `link()` returns null whenever `enabled` is false OR `tag` is empty,
// so leaving either unset is a safe no-op on the live site.

window.AFFILIATE_LINKS = {
  enabled: false,
  tag: "",

  // FTC-adjacent disclosure rendered immediately after each affiliate link.
  // 16 C.F.R. Part 255 requires disclosure to be clear and conspicuous.
  ftcDisclosure: "Affiliate link · we may earn a commission",

  // Required statement under the Amazon Associates Operating Agreement.
  // Render once per page that displays any Amazon affiliate link.
  associateStatement: "As an Amazon Associate, Woogoro LLC earns from qualifying purchases.",

  materials: {
    architectural: { label: "Shop architectural shingles", searchKey: "architectural+roof+shingles", retailer: "Amazon" },
    asphalt:       { label: "Shop 3-tab shingles",          searchKey: "3+tab+roof+shingles",         retailer: "Amazon" },
    metal:         { label: "Shop metal roofing panels",    searchKey: "metal+roofing+panels",        retailer: "Amazon" },
    tile:          { label: "Shop roof tiles",              searchKey: "roof+tiles",                  retailer: "Amazon" },
    cedar:         { label: "Shop cedar shakes",            searchKey: "cedar+shake+shingles",        retailer: "Amazon" },
    flat:          { label: "Shop flat roof materials",     searchKey: "flat+roof+membrane+roofing",  retailer: "Amazon" }
  },

  accessories: {
    underlayment:     { label: "Synthetic underlayment",                searchKey: "synthetic+roof+underlayment",            retailer: "Amazon" },
    ice_barrier:      { label: "Ice & water shield",                    searchKey: "ice+and+water+shield+roofing",           retailer: "Amazon" },
    ridge_vent:       { label: "Ridge vents",                           searchKey: "roof+ridge+vent",                        retailer: "Amazon" },
    impact_resistant: { label: "Class 4 impact-resistant shingles",     searchKey: "impact+resistant+roof+shingles+class+4", retailer: "Amazon" }
  },

  isLive: function() {
    return this.enabled === true && typeof this.tag === "string" && this.tag.length > 0;
  },

  buildUrl: function(searchKey) {
    return "https://www.amazon.com/s?k=" + encodeURIComponent(searchKey).replace(/%2B/g, "+") + "&tag=" + encodeURIComponent(this.tag);
  },

  // Returns the link HTML with FTC-adjacent disclosure baked in, or null when affiliates are off / unconfigured.
  link: function(key, type) {
    if (!this.isLive()) return null;
    const source = type === "accessory" ? this.accessories : this.materials;
    const item = source[key];
    if (!item) return null;
    const url = this.buildUrl(item.searchKey);
    return '<a href="' + url + '" target="_blank" rel="noopener sponsored nofollow" style="color:var(--brand); text-decoration:underline; font-weight:500;">'
      + item.label + ' on ' + item.retailer + ' &rarr;</a>'
      + ' <small style="color:#64748b; font-weight:400; font-size:12px;">' + this.ftcDisclosure + '</small>';
  },

  // Returns the page-level Amazon Associate statement HTML, or "" when affiliates are off / unconfigured.
  // Render once per page in a footer or under the affiliate widget.
  disclosureFooter: function() {
    if (!this.isLive()) return "";
    return '<div style="margin-top:12px; padding:10px 16px; font-size:12px; color:#64748b; line-height:1.5;">'
      + this.associateStatement
      + '</div>';
  }
};
