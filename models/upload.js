"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class upload extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  upload.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
      },
      file_name: DataTypes.STRING,
      user_id: {
        type: DataTypes.BIGINT,
        references: {
          model: "users",
          key: "id",
        },
      },
    },
    {
      sequelize,
      modelName: "upload",
    }
  );
  return upload;
};
