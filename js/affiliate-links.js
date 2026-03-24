// Affiliate link configuration
// Replace placeholder URLs with your actual affiliate tracking links
// after approval from Home Depot (Impact.com), Lowe's, or Amazon Associates.

window.AFFILIATE_LINKS = {
  // Set to true once you have real affiliate links
  enabled: false,

  // Material-specific product links
  materials: {
    architectural: {
      label: "Shop architectural shingles",
      url: "https://www.homedepot.com/b/Building-Materials-Roofing-Roof-Shingles/Architectural/N-5yc1vZar1fZ1z0k38e",
      retailer: "Home Depot"
    },
    asphalt: {
      label: "Shop 3-tab shingles",
      url: "https://www.homedepot.com/b/Building-Materials-Roofing-Roof-Shingles/3-Tab/N-5yc1vZar1fZ1z0k38d",
      retailer: "Home Depot"
    },
    metal: {
      label: "Shop metal roofing panels",
      url: "https://www.homedepot.com/b/Building-Materials-Roofing-Metal-Roofing/N-5yc1vZar2b",
      retailer: "Home Depot"
    },
    tile: {
      label: "Shop roof tiles",
      url: "https://www.homedepot.com/b/Building-Materials-Roofing/Tile/N-5yc1vZaqnsZ1z0k6o0",
      retailer: "Home Depot"
    },
    cedar: {
      label: "Shop cedar shakes",
      url: "https://www.homedepot.com/b/Building-Materials-Roofing/Cedar/N-5yc1vZaqnsZ1z0jr3c",
      retailer: "Home Depot"
    },
    flat: {
      label: "Shop flat roof materials",
      url: "https://www.homedepot.com/b/Building-Materials-Roofing-Roll-Roofing/N-5yc1vZar2a",
      retailer: "Home Depot"
    }
  },

  // Accessory/upgrade product links
  accessories: {
    underlayment: {
      label: "Synthetic underlayment",
      url: "https://www.homedepot.com/b/Building-Materials-Roofing-Roofing-Underlayments/N-5yc1vZar2c",
      retailer: "Home Depot"
    },
    ice_barrier: {
      label: "Ice & water shield",
      url: "https://www.homedepot.com/s/ice%20and%20water%20shield",
      retailer: "Home Depot"
    },
    ridge_vent: {
      label: "Ridge vents",
      url: "https://www.homedepot.com/b/Building-Materials-Roofing-Roof-Vents/Ridge-Vents/N-5yc1vZar29Z1z0jr83",
      retailer: "Home Depot"
    },
    impact_resistant: {
      label: "Class 4 impact-resistant shingles",
      url: "https://www.homedepot.com/s/class%204%20impact%20resistant%20shingles",
      retailer: "Home Depot"
    }
  },

  // Helper: returns HTML link or plain text if affiliates disabled
  link: function(key, type) {
    if (!this.enabled) return null;
    const source = type === "accessory" ? this.accessories : this.materials;
    const item = source[key];
    if (!item) return null;
    return `<a href="${item.url}" target="_blank" rel="noopener sponsored" style="color:var(--brand); text-decoration:underline; font-weight:500;">${item.label} at ${item.retailer} &rarr;</a>`;
  }
};
