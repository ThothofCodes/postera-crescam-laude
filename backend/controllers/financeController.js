// Copyright (c) 2026 Thoth of Codes. Licensed under the MIT License.
const DeptTransaction = require('../models/DeptTransaction');
const Department = require('../models/Department');

exports.getIncome = async (req, res, next) => {
  try {
    const { departmentId, range: _range = 'monthly', year = new Date().getFullYear() } = req.query;
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';

    // Scope: dept head can only see their own dept
    const matchDept = departmentId
      ? { department: require('mongoose').Types.ObjectId.createFromHexString(departmentId) }
      : isSuperAdmin
        ? {}
        : { department: req.user.department?._id || req.user.department };

    const matchDate = {
      date: {
        $gte: new Date(`${year}-01-01`),
        $lte: new Date(`${year}-12-31`),
      },
    };

    const pipeline = [
      { $match: { ...matchDept, ...matchDate } },
      {
        $group: {
          _id: {
            month: { $month: '$date' },
            type: '$type',
            ...(isSuperAdmin && !departmentId ? { departmentSlug: '$departmentSlug' } : {}),
          },
          total: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.month': 1 } },
    ];

    const results = await DeptTransaction.aggregate(pipeline);

    // Build 12-month chart data
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const chartData = months.map((name, i) => {
      const income = results.filter((r) => r._id.month === i + 1 && r._id.type === 'income').reduce((s, r) => s + r.total, 0);
      const expense = results.filter((r) => r._id.month === i + 1 && r._id.type === 'expense').reduce((s, r) => s + r.total, 0);
      return {
        name, month: i + 1, income, expense, net: income - expense,
      };
    });

    // Fetch target if dept scoped
    let targets = [];
    if (departmentId || (!isSuperAdmin && req.user.department)) {
      const deptId = departmentId || (req.user.department?._id || req.user.department);
      const dept = await Department.findById(deptId);
      targets = dept?.monthlyTargets || [];
    }

    // Attach targets to chart data
    chartData.forEach((d) => {
      const monthStr = `${year}-${String(d.month).padStart(2, '0')}`;
      const found = targets.find((t) => t.month === monthStr);
      d.target = found?.target || 0;
    });

    const totalIncome = chartData.reduce((s, d) => s + d.income, 0);
    const totalExpense = chartData.reduce((s, d) => s + d.expense, 0);
    const growthRate = chartData.length > 1
      ? (((chartData[chartData.length - 1].income - chartData[0].income) / (chartData[0].income || 1)) * 100).toFixed(1)
      : 0;

    res.json({
      chartData, totalIncome, totalExpense, netProfit: totalIncome - totalExpense, growthRate, year,
    });
  } catch (err) { next(err); }
};

exports.getDeptBreakdown = async (req, res, next) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    const breakdown = await DeptTransaction.aggregate([
      { $match: { type: 'income', date: { $gte: new Date(`${year}-01-01`), $lte: new Date(`${year}-12-31`) } } },
      { $group: { _id: '$departmentSlug', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
    ]);
    res.json(breakdown);
  } catch (err) { next(err); }
};

exports.getTransactions = async (req, res, next) => {
  try {
    const { type, page = 1, limit = 30 } = req.query;
    const filter = req.user.role === 'SUPER_ADMIN' ? {} : req.deptFilter;
    if (type) filter.type = type;
    const [transactions, total] = await Promise.all([
      DeptTransaction.find(filter).populate('createdBy', 'name').sort('-date').skip((page - 1) * limit)
        .limit(Number(limit)),
      DeptTransaction.countDocuments(filter),
    ]);
    res.json({ transactions, total, page: Number(page) });
  } catch (err) { next(err); }
};

exports.createTransaction = async (req, res, next) => {
  try {
    const deptId = req.user.department?._id || req.user.department;
    const deptSlug = req.user.departmentSlug;
    const tx = await DeptTransaction.create({
      ...req.body,
      department: req.body.department || deptId,
      departmentSlug: req.body.departmentSlug || deptSlug,
      createdBy: req.user._id,
    });
    const { invalidateMultiple } = require('../middleware/cache');
    invalidateMultiple(['finance:breakdown', 'analytics', 'deptAnalytics']).catch(() => {});
    res.status(201).json(tx);
  } catch (err) { next(err); }
};

exports.deleteTransaction = async (req, res, next) => {
  try {
    await DeptTransaction.findByIdAndDelete(req.params.id);
    const { invalidateMultiple } = require('../middleware/cache');
    invalidateMultiple(['finance:breakdown', 'analytics', 'deptAnalytics']).catch(() => {});
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
};
