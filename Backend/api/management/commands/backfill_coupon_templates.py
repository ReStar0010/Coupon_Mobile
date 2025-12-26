from django.core.management.base import BaseCommand
from django.utils import timezone
from api.models import Coupon, CouponTemplate, Store


class Command(BaseCommand):
    help = 'Backfill CouponTemplate for legacy store coupons that have template=None'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Run without making changes (preview mode)',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be made'))
        
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(self.style.SUCCESS('Backfilling CouponTemplate for legacy store coupons'))
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write('')
        
        # Find all store coupons without template
        legacy_coupons = Coupon.objects.filter(
            coupon_type='store',
            template__isnull=True
        ).select_related('store')
        
        total_count = legacy_coupons.count()
        self.stdout.write(f'Found {total_count} store coupons without template')
        self.stdout.write('')
        
        if total_count == 0:
            self.stdout.write(self.style.SUCCESS('No coupons need backfilling. All done!'))
            return
        
        processed_count = 0
        created_templates_count = 0
        skipped_count = 0
        errors = []
        
        # Group coupons by store to process more efficiently
        coupons_by_store = {}
        for coupon in legacy_coupons:
            store_id = coupon.store_id
            if store_id not in coupons_by_store:
                coupons_by_store[store_id] = []
            coupons_by_store[store_id].append(coupon)
        
        self.stdout.write(f'Processing {len(coupons_by_store)} stores...')
        self.stdout.write('')
        
        for store_id, coupons in coupons_by_store.items():
            store = coupons[0].store
            
            # Group coupons by stable key (same template should have same key)
            # Key: (coupon_name, coupon_detail, important_notes, start_date, expiry_date, image_url, estimated_savings)
            template_groups = {}
            
            for coupon in coupons:
                # Create stable key for grouping
                key = (
                    coupon.coupon_name or '',
                    coupon.coupon_detail or '',
                    coupon.important_notes or '',
                    coupon.start_date,
                    coupon.expiry_date,
                    coupon.image_url or '',
                    float(coupon.estimated_savings) if coupon.estimated_savings else None,
                )
                
                if key not in template_groups:
                    template_groups[key] = []
                template_groups[key].append(coupon)
            
            # Process each group
            for key, group_coupons in template_groups.items():
                coupon_name, coupon_detail, important_notes, start_date, expiry_date, image_url, estimated_savings = key
                
                # Check if template already exists for this store with same key
                existing_template = CouponTemplate.objects.filter(
                    store=store,
                    coupon_name=coupon_name,
                    coupon_detail=coupon_detail,
                    start_date=start_date,
                    expiry_date=expiry_date,
                    total_quantity=0,  # Store type templates have total_quantity=0
                ).first()
                
                if existing_template:
                    # Use existing template
                    template = existing_template
                    self.stdout.write(
                        self.style.WARNING(
                            f'  Using existing template (ID: {template.id}) for "{coupon_name}"'
                        )
                    )
                else:
                    # Create new template
                    # Check if expired
                    now = timezone.now()
                    is_active = expiry_date > now if expiry_date else True
                    
                    if not dry_run:
                        template = CouponTemplate.objects.create(
                            store=store,
                            coupon_name=coupon_name,
                            coupon_detail=coupon_detail,
                            important_notes=important_notes,
                            start_date=start_date,
                            expiry_date=expiry_date,
                            image_url=image_url,
                            estimated_savings=estimated_savings,
                            total_quantity=0,  # Store type (一般/隨取及用)
                            remaining_quantity=0,
                            draw_probability=0.0,
                            is_active=is_active,
                        )
                        created_templates_count += 1
                        self.stdout.write(
                            self.style.SUCCESS(
                                f'  Created template (ID: {template.id}) for "{coupon_name}"'
                            )
                        )
                    else:
                        self.stdout.write(
                            self.style.WARNING(
                                f'  [DRY RUN] Would create template for "{coupon_name}"'
                            )
                        )
                        template = None  # Skip binding in dry run
                
                # Bind all coupons in this group to the template
                for coupon in group_coupons:
                    if template and not dry_run:
                        coupon.template = template
                        coupon.save(update_fields=['template'])
                        processed_count += 1
                    elif dry_run:
                        processed_count += 1
        
        # Summary
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(self.style.SUCCESS('Backfill Summary'))
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(f'Total coupons found: {total_count}')
        self.stdout.write(f'Coupons processed: {processed_count}')
        self.stdout.write(f'Templates created: {created_templates_count}')
        self.stdout.write(f'Coupons skipped: {skipped_count}')
        
        if errors:
            self.stdout.write(self.style.ERROR(f'Errors: {len(errors)}'))
            for error in errors[:10]:  # Show first 10 errors
                self.stdout.write(self.style.ERROR(f'  - {error}'))
        
        if dry_run:
            self.stdout.write('')
            self.stdout.write(self.style.WARNING('This was a DRY RUN. No changes were made.'))
            self.stdout.write(self.style.WARNING('Run without --dry-run to apply changes.'))
        else:
            self.stdout.write('')
            self.stdout.write(self.style.SUCCESS('Backfill completed successfully!'))
            self.stdout.write('')
            self.stdout.write('Next steps:')
            self.stdout.write('1. Verify that all coupons now have template_id')
            self.stdout.write('2. Test that coupon detail pages return template_id')
            self.stdout.write('3. Verify that template_view logs are being created')

