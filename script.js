function startCounter({
  elementId,
  startValue,
  dailyIncrement,
  formatter = (num) => "$" + Math.floor(num).toLocaleString("en-US"),
}) {
  const valueEl = document.getElementById(elementId);
  let currentValue = startValue;

  function tick() {
    currentValue += dailyIncrement / (24 * 60 * 60 * 60); // assume ~60fps
    valueEl.textContent = formatter(currentValue);
    requestAnimationFrame(tick);
  }

  tick();
}

function renderBreakdown({
  elementId,
  rows = [],
  containerTag = "div",
  containerIdSuffix = "-breakdown",
  rowTag = "div",
  renderRow = (label, value) => {
    const row = document.createElement(rowTag);
    row.className = "flex items-baseline justify-between gap-3 py-1";

    const labelEl = document.createElement("span");
    labelEl.className = "text-xs md:text-sm text-neutral-300";
    labelEl.textContent = label;

    const valueEl = document.createElement("span");
    valueEl.className = "text-base md:text-xl font-bold font-mono";
    valueEl.textContent = value;

    row.appendChild(labelEl);
    row.appendChild(valueEl);
    return row;
  },
}) {
  const mainDiv = document.getElementById(elementId);

  // Remove old breakdown if it exists (for hot reloads)
  let oldBreakdown = document.getElementById(`${elementId}${containerIdSuffix}`);
  if (oldBreakdown) oldBreakdown.remove();

  const container = document.createElement(containerTag);
  container.id = `${elementId}${containerIdSuffix}`;

  // Add rows (expects [{label, value}, ...])
  rows.forEach(({ label, value }) => {
    const rowEl = renderRow(label, value);
    container.appendChild(rowEl);
  });

  // Insert after mainDiv
  mainDiv.insertAdjacentElement('afterend', container);
}

//future version with backend needs to update this
const gasNow = 4.120;

const oilSpot = 102.80;
const oil3M = 84.37;
const oil6M = 75.06;
const oil1Y = 72.60;
const oil2Y = 68.93;
const oil3Y = 66.56;

const discount = 0.043; //10yr yield

const mortgage30yr = 6.46;

const corePCEYoy = 3.10;



const gasFeb23 = 2.937;
const oilFeb27 = 67.02;
const mortgage30yrFeb26 = 5.98;
const avrHomeSale = 534000;



const msPerDay = 24 * 60 * 60 * 1000;
const now = new Date();
const april7 = new Date(2026, 3, 7);
const feb27 = new Date(2026, 2, 28); 

const daysSinceApril7 = (now - april7) / msPerDay;
const daysSinceStartWar = (now - april7) / msPerDay;

const medianHouseholdPortion = 3130 / (4.4 * 1e12);
const numHouseholds = 133700000;

const calculateTotal = (april7Value, dailyIncrement, daysSinceApril7) =>
  april7Value + dailyIncrement * daysSinceApril7;

const calculateAnnualTotal = (totalValue, dailyIncrement, daysSinceStartWar) =>
  totalValue + (365-daysSinceStartWar) * dailyIncrement;


// Calculate oil PDV using oil price variables and formula:
//
// PDV_oil = sum_i ( (p_i^futures - p^base) * Δt_i * exp(-r * t_i) )
//
// where
//  - oil3M, oil6M, oil1Y, oil2Y, oil3Y: future prices
//  - p^base = 72
//  - Δt_i: [0.25, 0.25, 0.5, 1.0, 1.0]
//  - t_i: [0.125, 0.375, 0.75, 1.5, 2.5] (interval midpoints, in years)
//  - r = discount

const pBase = oilFeb27;
const r = discount;

const oilPDVDeviationApprox =
  (oilSpot - pBase) * 0.25 * Math.exp(-r * 0.125) +  // spot → 3M
  (oil3M - pBase)   * 0.25 * Math.exp(-r * 0.375) +  // 3M → 6M
  (oil6M - pBase)   * 0.50 * Math.exp(-r * 0.75)  +  // 6M → 1Y
  (oil1Y - pBase)   * 1.0  * Math.exp(-r * 1.5)   +  // 1Y → 2Y
  (oil2Y - pBase)   * 1.0  * Math.exp(-r * 2.5)   +  // 2Y → 3Y
  (oil3Y - pBase)   * 1.0  * Math.exp(-r * 3.5);     // 3Y+
// Gürkaynak & Känzig paper shock: $7.50 → 10bp (0.10%) core PCE
const kanzigShockOilDollar = 7.50;
const kanzigShockCorePCEbp = 10; // basis points
// Scaled permanent core PCE price level effect (in bp)
const scaledCorePCEbp = kanzigShockCorePCEbp * (oilPDVDeviationApprox / kanzigShockOilDollar); 

// Console/debug output
// console.log("Oil PDV deviation ($/barrel):", oilPDVDeviationApprox.toFixed(2));
// console.log("Estimated permanent core PCE price level increase:", scaledCorePCEbp.toFixed(2), "bp (~" + (scaledCorePCEbp/100).toFixed(3) + "%)");
const medianCoreSpending = 65000;
const corePCEIncrease = scaledCorePCEbp / 10000;
const annualInflation = medianCoreSpending * corePCEIncrease;
const pdvInflation = annualInflation / discount;




function calculateTotalHomePaidPDV(mortgageRate, discountRate = discount) {
  // 20% down payment
  const downPayment = 0.20 * avrHomeSale;

  // Loan principal
  const loanAmount = avrHomeSale - downPayment;

  // loan terms: using 30y fixed, custom rate
  const mortgageTermYears = 30;
  const mortgageTermMonths = mortgageTermYears * 12;
  const monthlyRate = mortgageRate / 100 / 12;

  // Monthly payment formula (fixed-rate mortgage)
  const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, mortgageTermMonths)) /
    (Math.pow(1 + monthlyRate, mortgageTermMonths) - 1);

  // Total paid over 30 years (principal + interest + down payment)
  const totalPaid = monthlyPayment * mortgageTermMonths + downPayment;

  // Calculate present discounted value (PDV) of the stream of monthly payments, plus down payment
  let pdv = downPayment;
  const monthlyDiscount = Math.pow(1 + discountRate, 1/12);

  for (let month = 1; month <= mortgageTermMonths; month++) {
    pdv += monthlyPayment / Math.pow(monthlyDiscount, month);
  }

  return {
    totalPaid,
    monthlyPayment,
    pdv
  };
}

const housingNow = calculateTotalHomePaidPDV(mortgage30yr);
const housingPrewar = calculateTotalHomePaidPDV(mortgage30yrFeb26);

const totalHousing = housingNow.totalPaid - housingPrewar.totalPaid;
const monthlyHousing = housingNow.monthlyPayment - housingPrewar.monthlyPayment;
// const pdvDiff = housingNow.pdv - housingPrewar.pdv;









const dailyDirectWar = 0 //500000000;
const totalDirectWarApr7 = 31020000000;
const totalDirectWar = calculateTotal(totalDirectWarApr7, dailyDirectWar, daysSinceApril7);
const annualDirectWar = calculateAnnualTotal(totalDirectWar, dailyDirectWar, daysSinceStartWar);
// dailyDirectWarPH = dailyDirectWar * medianHouseholdPortion;
// totalDirectWarPH = totalDirectWar * medianHouseholdPortion;
// annualDirectWarPH = annualDirectWar * medianHouseholdPortion;
const dailyDirectWarPH = dailyDirectWar/numHouseholds;
const totalDirectWarPH = totalDirectWar/numHouseholds;
const annualDirectWarPH = annualDirectWar/numHouseholds;




const dailyGas = (gasNow - gasFeb23)*375698630;
const totalGasApr7 = 10101409065;
const totalGas = calculateTotal(totalGasApr7, dailyGas, daysSinceApril7);
const annualGas = calculateAnnualTotal(totalGas, dailyGas, daysSinceStartWar);
const dailyGasPH = dailyGas/numHouseholds;
const totalGasPH = totalGas/numHouseholds;
const annualGasPH = annualGas/numHouseholds;







startCounter({
  elementId: "direct",
  startValue: totalDirectWar,
  dailyIncrement: dailyDirectWar,
});

startCounter({
  elementId: "gas",
  startValue: totalGas,
  dailyIncrement: dailyGas,
});



startCounter({
  elementId: "corepce",
  startValue: pdvInflation * numHouseholds,
  dailyIncrement: 0,
});

startCounter({
  elementId: "housing",
  startValue: 11000 * totalHousing / daysSinceStartWar,
  dailyIncrement: 11000 * totalHousing,
});



const fmt = (n) => {
  const floored = Math.floor(n * 100) / 100;
  return "$" + floored.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const gasFebValueEl = document.getElementById("gas-feb-value");
if (gasFebValueEl) gasFebValueEl.textContent = fmt(gasFeb23);

const gasTodayValueEl = document.getElementById("gas-today-value");
if (gasTodayValueEl) gasTodayValueEl.textContent = fmt(gasNow);

// const directApr7El = document.getElementById("direct-apr7-value");
// if (directApr7El) directApr7El.textContent = `${fmt(totalDirectWarApr7 / 1e9)}B`;

// const directTodayEl = document.getElementById("direct-today-value");
// if (directTodayEl) directTodayEl.textContent = `${fmt(totalDirectWar / 1e9)}B`;

const oilFebEl = document.getElementById("oil-feb-value");
if (oilFebEl) oilFebEl.textContent = (corePCEYoy).toFixed(2) + "%";

const oilSpotEl = document.getElementById("oil-spot-value");
if (oilSpotEl) oilSpotEl.textContent = (corePCEIncrease * 100).toFixed(2) + "%";

const mortgageFebEl = document.getElementById("mortgage-feb-value");
if (mortgageFebEl) mortgageFebEl.textContent = `${mortgage30yrFeb26.toFixed(2)}%`;

const mortgageTodayEl = document.getElementById("mortgage-today-value");
if (mortgageTodayEl) mortgageTodayEl.textContent = `${mortgage30yr.toFixed(2)}%`;



//total cost per hosuehold
dailyCostHH = dailyDirectWarPH + dailyGasPH;
totalCostHH = totalDirectWarPH + totalGasPH + pdvInflation;
totalCostHHYear = annualDirectWarPH + annualGasPH + pdvInflation;
document.getElementById("total-per-household").textContent = fmt(totalCostHH);


// startCounter({
//   elementId: "total-per-household",
//   startValue: totalCostHH,
//   dailyIncrement: dailyCostHH,
// });




renderBreakdown({
  elementId: "direct",
  rows: [
    { label: "Total cost", value: `${fmt(totalDirectWar/1e9)}B` },
    { label: "Daily cost", value: `${fmt(dailyDirectWar/1e9)}B` },
    { label: "Annualized cost", value: `${fmt(annualDirectWar/1e9)}B` },
    { label: "Total cost per household", value: fmt(totalDirectWarPH) },
    { label: "Daily cost per household", value: fmt(dailyDirectWarPH) },
    { label: "Annualized cost per household", value: fmt(annualDirectWarPH) },
  ],
});

renderBreakdown({
  elementId: "gas",
  rows: [
    { label: "Total cost", value: `${fmt(totalGas/1e9)}B` },
    { label: "Daily cost", value: `${fmt(dailyGas/1e9)}B` },
    { label: "Annualized cost", value: `${fmt(annualGas/1e9)}B` },
    { label: "Total cost per household", value: fmt(totalGasPH) },
    { label: "Daily cost per household", value: fmt(dailyGasPH) },
    { label: "Annualized cost per household", value: fmt(annualGasPH) },
  ],
});

renderBreakdown({
  elementId: "corepce",
  rows: [
    { label: "This year's (future) cost per household", value: fmt(annualInflation) },
    { label: "Lifetime cost per household", value: fmt(pdvInflation) },
  ],
});

renderBreakdown({
  elementId: "housing",
  rows: [
    { label: "Monthly payment cost", value: fmt(monthlyHousing) },
    { label: "Lifetime cost per home bought", value: fmt(totalHousing) },
  ],
});

