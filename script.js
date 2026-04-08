(() => {
  "use strict";

  const INPUTS = {
    gasNow: 4.120,
    gasFeb23: 2.937,
    oilSpot: 102.80,
    oil3M: 84.37,
    oil6M: 75.06,
    oil1Y: 72.60,
    oil2Y: 68.93,
    oil3Y: 66.56,
    oilFeb27: 67.02,
    mortgage30yr: 6.46,
    mortgage30yrFeb26: 5.98,
    corePCEYoy: 3.10,
    discount: 0.043,
    averageHomeSale: 534000,
    numHouseholds: 133700000,
    dailyDirectWar: 0,
    totalDirectWarApr7: 31020000000,
    totalGasApr7: 10101409065,
    dailyHomeSales: 11000,
    annualGasGallonsEstimate: 375698630,
    medianCoreSpending: 65000,
    kanzigShockOilDollar: 7.50,
    kanzigShockCorePCEbp: 10,
    baselineDate: new Date(2026, 3, 7),
  };

  function formatMoney(num) {
    const floored = Math.floor(num * 100) / 100;
    return "$" + floored.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function startCounter({
    elementId,
    startValue,
    dailyIncrement,
    formatter = (num) => "$" + Math.floor(num).toLocaleString("en-US"),
  }) {
    const valueEl = document.getElementById(elementId);
    if (!valueEl) return;

    let currentValue = startValue;
    const perFrame = dailyIncrement / (24 * 60 * 60 * 60);

    function tick() {
      currentValue += perFrame;
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
    if (!mainDiv) return;

    const oldBreakdown = document.getElementById(`${elementId}${containerIdSuffix}`);
    if (oldBreakdown) oldBreakdown.remove();

    const container = document.createElement(containerTag);
    container.id = `${elementId}${containerIdSuffix}`;

    rows.forEach(({ label, value }) => {
      container.appendChild(renderRow(label, value));
    });

    mainDiv.insertAdjacentElement("afterend", container);
  }

  function calculateAnnualTotal(totalValue, dailyIncrement, daysSinceStart) {
    return totalValue + (365 - daysSinceStart) * dailyIncrement;
  }

  function calculateTotal(baseValue, dailyIncrement, daysSinceBase) {
    return baseValue + dailyIncrement * daysSinceBase;
  }

  function calculateTotalHomePaidPDV(mortgageRate, averageHomeSale, discountRate) {
    const downPayment = 0.20 * averageHomeSale;
    const loanAmount = averageHomeSale - downPayment;
    const mortgageTermMonths = 30 * 12;
    const monthlyRate = mortgageRate / 100 / 12;
    const monthlyPayment =
      (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, mortgageTermMonths))) /
      (Math.pow(1 + monthlyRate, mortgageTermMonths) - 1);
    const totalPaid = monthlyPayment * mortgageTermMonths + downPayment;

    let pdv = downPayment;
    const monthlyDiscount = Math.pow(1 + discountRate, 1 / 12);
    for (let month = 1; month <= mortgageTermMonths; month += 1) {
      pdv += monthlyPayment / Math.pow(monthlyDiscount, month);
    }

    return { totalPaid, monthlyPayment, pdv };
  }

  function computeMetrics(input) {
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysSinceStart = (Date.now() - input.baselineDate.getTime()) / msPerDay;

    const oilPDVDeviationApprox =
      (input.oilSpot - input.oilFeb27) * 0.25 * Math.exp(-input.discount * 0.125) +
      (input.oil3M - input.oilFeb27) * 0.25 * Math.exp(-input.discount * 0.375) +
      (input.oil6M - input.oilFeb27) * 0.50 * Math.exp(-input.discount * 0.75) +
      (input.oil1Y - input.oilFeb27) * 1.0 * Math.exp(-input.discount * 1.5) +
      (input.oil2Y - input.oilFeb27) * 1.0 * Math.exp(-input.discount * 2.5) +
      (input.oil3Y - input.oilFeb27) * 1.0 * Math.exp(-input.discount * 3.5);

    const scaledCorePCEbp =
      input.kanzigShockCorePCEbp * (oilPDVDeviationApprox / input.kanzigShockOilDollar);
    const corePCEIncrease = scaledCorePCEbp / 10000;
    const annualInflation = input.medianCoreSpending * corePCEIncrease;
    const pdvInflation = annualInflation / input.discount;

    const housingNow = calculateTotalHomePaidPDV(
      input.mortgage30yr,
      input.averageHomeSale,
      input.discount
    );
    const housingPrewar = calculateTotalHomePaidPDV(
      input.mortgage30yrFeb26,
      input.averageHomeSale,
      input.discount
    );
    const totalHousing = housingNow.totalPaid - housingPrewar.totalPaid;
    const monthlyHousing = housingNow.monthlyPayment - housingPrewar.monthlyPayment;

    const totalDirectWar = calculateTotal(
      input.totalDirectWarApr7,
      input.dailyDirectWar,
      daysSinceStart
    );
    const annualDirectWar = calculateAnnualTotal(
      totalDirectWar,
      input.dailyDirectWar,
      daysSinceStart
    );

    const dailyGas = (input.gasNow - input.gasFeb23) * input.annualGasGallonsEstimate;
    const totalGas = calculateTotal(input.totalGasApr7, dailyGas, daysSinceStart);
    const annualGas = calculateAnnualTotal(totalGas, dailyGas, daysSinceStart);

    const dailyDirectWarPH = input.dailyDirectWar / input.numHouseholds;
    const totalDirectWarPH = totalDirectWar / input.numHouseholds;
    const annualDirectWarPH = annualDirectWar / input.numHouseholds;
    const dailyGasPH = dailyGas / input.numHouseholds;
    const totalGasPH = totalGas / input.numHouseholds;
    const annualGasPH = annualGas / input.numHouseholds;
    const totalCostHH = totalDirectWarPH + totalGasPH + pdvInflation;

    return {
      daysSinceStart,
      totalDirectWar,
      annualDirectWar,
      dailyDirectWarPH,
      totalDirectWarPH,
      annualDirectWarPH,
      dailyGas,
      totalGas,
      annualGas,
      dailyGasPH,
      totalGasPH,
      annualGasPH,
      corePCEIncrease,
      annualInflation,
      pdvInflation,
      totalHousing,
      monthlyHousing,
      totalCostHH,
    };
  }

  function renderShowMore(inputs, metrics) {
    setText("gas-feb-value", formatMoney(inputs.gasFeb23));
    setText("gas-today-value", formatMoney(inputs.gasNow));
    setText("oil-feb-value", `${inputs.corePCEYoy.toFixed(2)}%`);
    setText("oil-spot-value", `${(metrics.corePCEIncrease * 100).toFixed(2)}%`);
    setText("mortgage-feb-value", `${inputs.mortgage30yrFeb26.toFixed(2)}%`);
    setText("mortgage-today-value", `${inputs.mortgage30yr.toFixed(2)}%`);
  }

  function renderBreakdowns(metrics) {
    renderBreakdown({
      elementId: "direct",
      rows: [
        { label: "Total cost", value: `${formatMoney(metrics.totalDirectWar / 1e9)}B` },
        { label: "Daily cost", value: `${formatMoney(INPUTS.dailyDirectWar / 1e9)}B` },
        { label: "Annualized cost", value: `${formatMoney(metrics.annualDirectWar / 1e9)}B` },
        { label: "Total cost per household", value: formatMoney(metrics.totalDirectWarPH) },
        { label: "Daily cost per household", value: formatMoney(metrics.dailyDirectWarPH) },
        { label: "Annualized cost per household", value: formatMoney(metrics.annualDirectWarPH) },
      ],
    });

    renderBreakdown({
      elementId: "gas",
      rows: [
        { label: "Total cost", value: `${formatMoney(metrics.totalGas / 1e9)}B` },
        { label: "Daily cost", value: `${formatMoney(metrics.dailyGas / 1e9)}B` },
        { label: "Annualized cost", value: `${formatMoney(metrics.annualGas / 1e9)}B` },
        { label: "Total cost per household", value: formatMoney(metrics.totalGasPH) },
        { label: "Daily cost per household", value: formatMoney(metrics.dailyGasPH) },
        { label: "Annualized cost per household", value: formatMoney(metrics.annualGasPH) },
      ],
    });

    renderBreakdown({
      elementId: "corepce",
      rows: [
        { label: "This year's (future) cost per household", value: formatMoney(metrics.annualInflation) },
        { label: "Lifetime cost per household", value: formatMoney(metrics.pdvInflation) },
      ],
    });

    renderBreakdown({
      elementId: "housing",
      rows: [
        { label: "Monthly payment cost", value: formatMoney(metrics.monthlyHousing) },
        { label: "Lifetime cost per home bought", value: formatMoney(metrics.totalHousing) },
      ],
    });
  }

  function startAllCounters(metrics) {
    startCounter({
      elementId: "direct",
      startValue: metrics.totalDirectWar,
      dailyIncrement: INPUTS.dailyDirectWar,
    });

    startCounter({
      elementId: "gas",
      startValue: metrics.totalGas,
      dailyIncrement: metrics.dailyGas,
    });

    startCounter({
      elementId: "corepce",
      startValue: metrics.pdvInflation * INPUTS.numHouseholds,
      dailyIncrement: 0,
    });

    startCounter({
      elementId: "housing",
      startValue: INPUTS.dailyHomeSales * metrics.totalHousing / metrics.daysSinceStart,
      dailyIncrement: INPUTS.dailyHomeSales * metrics.totalHousing,
    });
  }

  function init() {
    const metrics = computeMetrics(INPUTS);
    startAllCounters(metrics);
    renderShowMore(INPUTS, metrics);
    setText("total-per-household", formatMoney(metrics.totalCostHH));
    renderBreakdowns(metrics);
  }

  init();
})();

