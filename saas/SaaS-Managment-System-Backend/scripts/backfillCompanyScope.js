const Workspace = require("../models/Workspace");
const Board = require("../models/Board");
const Conversation = require("../models/Conversation");
const User = require("../models/User");

async function backfillWorkspaceCompanies() {
  const workspaces = await Workspace.find({
    $or: [{ companyId: { $exists: false } }, { companyId: null }, { companyId: "" }],
  })
    .select("_id owner companyId companyName")
    .lean();

  for (const workspace of workspaces) {
    if (!workspace.owner) continue;

    const owner = await User.findById(workspace.owner)
      .select("companyId companyName")
      .lean();

    if (!owner?.companyId) continue;

    await Workspace.updateOne(
      { _id: workspace._id },
      {
        $set: {
          companyId: owner.companyId,
          companyName: owner.companyName || "",
        },
      }
    );
  }
}

async function backfillBoardCompanies() {
  const boards = await Board.find({
    $or: [{ companyId: { $exists: false } }, { companyId: null }, { companyId: "" }],
  })
    .select("_id workspace")
    .lean();

  for (const board of boards) {
    if (!board.workspace) continue;

    const workspace = await Workspace.findById(board.workspace)
      .select("companyId")
      .lean();

    if (!workspace?.companyId) continue;

    await Board.updateOne(
      { _id: board._id },
      {
        $set: {
          companyId: workspace.companyId,
        },
      }
    );
  }
}

async function backfillConversationCompanies() {
  const conversations = await Conversation.find({
    $or: [{ companyId: { $exists: false } }, { companyId: null }, { companyId: "" }],
    type: "direct",
  })
    .select("_id members")
    .lean();

  for (const conversation of conversations) {
    const memberIds = Array.isArray(conversation.members) ? conversation.members : [];
    if (memberIds.length !== 2) continue;

    const members = await User.find({ _id: { $in: memberIds } })
      .select("companyId")
      .lean();

    if (members.length !== 2) continue;

    const companyIds = [...new Set(members.map((member) => member.companyId).filter(Boolean))];
    if (companyIds.length !== 1) continue;

    await Conversation.updateOne(
      { _id: conversation._id },
      {
        $set: {
          companyId: companyIds[0],
        },
      }
    );
  }
}

async function backfillCompanyScope() {
  await backfillWorkspaceCompanies();
  await backfillBoardCompanies();
  await backfillConversationCompanies();
}

module.exports = { backfillCompanyScope };
