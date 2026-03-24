// Affiliate link configuration — Amazon Associates
// Store ID: trueprice0d-20

window.AFFILIATE_LINKS = {
  enabled: true,
  tag: "trueprice0d-20",

  // Material-specific product links
  materials: {
    architectural: {
      label: "Shop architectural shingles",
      url: "https://www.amazon.com/s?k=architectural+roof+shingles&tag=trueprice0d-20",
      retailer: "Amazon"
    },
    asphalt: {
      label: "Shop 3-tab shingles",
      url: "https://www.amazon.com/s?k=3+tab+roof+shingles&tag=trueprice0d-20",
      retailer: "Amazon"
    },
    metal: {
      label: "Shop metal roofing panels",
      url: "https://www.amazon.com/s?k=metal+roofing+panels&tag=trueprice0d-20",
      retailer: "Amazon"
    },
    tile: {
      label: "Shop roof tiles",
      url: "https://www.amazon.com/s?k=roof+tiles&tag=trueprice0d-20",
      retailer: "Amazon"
    },
    cedar: {
      label: "Shop cedar shakes",
      url: "https://www.amazon.com/s?k=cedar+shake+shingles&tag=trueprice0d-20",
      retailer: "Amazon"
    },
    flat: {
      label: "Shop flat roof materials",
      url: "https://www.amazon.com/s?k=flat+roof+membrane+roofing&tag=trueprice0d-20",
      retailer: "Amazon"
    }
  },

  // Accessory/upgrade product links
  accessories: {
    underlayment: {
      label: "Synthetic underlayment",
      url: "https://www.amazon.com/s?k=synthetic+roof+underlayment&tag=trueprice0d-20",
      retailer: "Amazon"
    },
    ice_barrier: {
      label: "Ice & water shield",
      url: "https://www.amazon.com/s?k=ice+and+water+shield+roofing&tag=trueprice0d-20",
      retailer: "Amazon"
    },
    ridge_vent: {
      label: "Ridge vents",
      url: "https://www.amazon.com/s?k=roof+ridge+vent&tag=trueprice0d-20",
      retailer: "Amazon"
    },
    impact_resistant: {
      label: "Class 4 impact-resistant shingles",
      url: "https://www.amazon.com/s?k=impact+resistant+roof+shingles+class+4&tag=trueprice0d-20",
      retailer: "Amazon"
    }
  },

  // Helper: returns HTML link or plain text if affiliates disabled
  link: function(key, type) {
    if (!this.enabled) return null;
    const source = type === "accessory" ? this.accessories : this.materials;
    const item = source[key];
    if (!item) return null;
    return `<a href="${item.url}" target="_blank" rel="noopener sponsored" style="color:var(--brand); text-decoration:underline; font-weight:500;">${item.label} on ${item.retailer} &rarr;</a>`;
  }
};
