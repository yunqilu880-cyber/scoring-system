# 评分系统服务器部署说明

这版已经从纯前端演示版改为“前端 + Node 后端 + 文件数据存储”的真实部署版。

## 服务器要求

- Ubuntu 20.04/22.04/24.04
- Node.js 18 或以上
- Nginx
- 建议开放端口：`22`、`80`，有域名和 HTTPS 时再开放 `443`

## 首次部署

```bash
sudo apt update
sudo apt install -y git nginx nodejs npm
sudo npm install -g pm2

sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/yunqilu880-cyber/scoring-system.git
sudo chown -R $USER:$USER /var/www/scoring-system

cd /var/www/scoring-system
npm ci
npm run build
```

编辑 `deploy/ecosystem.config.cjs`，把 `ADMIN_PASSWORD` 改成正式强密码。

```bash
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup
```

## Nginx

```bash
sudo cp deploy/nginx-scoring-system.conf /etc/nginx/sites-available/scoring-system
sudo ln -s /etc/nginx/sites-available/scoring-system /etc/nginx/sites-enabled/scoring-system
sudo nginx -t
sudo systemctl reload nginx
```

配置完成后访问：

```text
http://服务器IP/
```

## 正式使用流程

1. 管理员登录审核端。
2. 在“用户数据”里新增或批量导入用户。
3. 未激活用户会自动生成邀请码。
4. 用户打开网站，选择“邀请码激活”，输入用户编号、邀请码并设置密码。
5. 用户登录后上传加分项和证明图片。
6. 管理员在“材料审核”中预览图片，通过或驳回。
7. “排名结果”自动统计总分，可导出 CSV，Excel 可以直接打开。

## 重要配置

后台服务读取这些环境变量：

```bash
PORT=3000
DATA_DIR=/var/www/scoring-system/data
ADMIN_USERNAME=admin
ADMIN_PASSWORD=请改成强密码
COOKIE_SECURE=false
```

如果配置了 HTTPS，可以把 `COOKIE_SECURE` 改为 `true`。

## 数据位置和备份

默认数据目录：

```text
/var/www/scoring-system/data
```

其中：

- `data.json` 保存用户、邀请码、审核记录、评分规则。
- `uploads/` 保存用户上传的证明图片。

建议定期备份：

```bash
tar -czf scoring-system-data-$(date +%F).tar.gz /var/www/scoring-system/data
```

## 更新代码

```bash
cd /var/www/scoring-system
git pull
npm ci
npm run build
pm2 restart scoring-system
```
